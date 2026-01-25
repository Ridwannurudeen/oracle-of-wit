# { "Depends": "py-genlayer:test" }
"""
Oracle of Wit - A Multiplayer AI Humor Prediction Game
=======================================================

An Intelligent Contract for GenLayer that showcases:
- Non-deterministic LLM calls for creative content generation
- Subjective AI judgment with Optimistic Democracy consensus
- Multi-room multiplayer game mechanics
- XP-based betting and rewards system

Game Flow:
1. Create/join a room (4-10 players recommended)
2. AI generates a funny joke setup prompt
3. Players submit punchlines (anonymous IDs assigned)
4. Players bet on which submission AI will rank #1
5. AI ranks all submissions by humor/creativity
6. Winners receive XP rewards from the prize pool

Author: GenLayer Contest Submission
"""

from genlayer import *
from dataclasses import dataclass
import json
import typing
import random

# ============================================================================
# DATA STRUCTURES
# ============================================================================

@allow_storage
@dataclass
class Submission:
    """A player's punchline submission"""
    author: str           # Address as hex string
    text: str             # The punchline (max 200 chars)
    anonymous_id: i32     # Random ID shown during betting phase


@allow_storage
@dataclass
class Bet:
    """A player's bet on a submission"""
    player: str           # Address as hex string
    submission_id: i32    # The anonymous_id they're betting on
    amount: u256          # XP amount wagered


@allow_storage
@dataclass
class PlayerScore:
    """Cumulative player statistics for leaderboard"""
    address: str          # Address as hex string
    total_xp: u256        # Total XP earned
    wins_as_author: u256  # Times ranked #1 for submission
    correct_predictions: u256  # Times correctly predicted winner
    games_played: u256    # Total games participated in
    last_active_week: u256  # Week number for weekly reset tracking


@allow_storage
@dataclass
class GameRoom:
    """State for a single game instance"""
    game_id: str                    # Unique game identifier
    host: str                       # Address of room creator
    status: str                     # "waiting", "submitting", "betting", "judging", "finished"
    min_players: i32                # Minimum players to start
    max_players: i32                # Maximum players allowed
    bet_min: u256                   # Minimum bet amount
    bet_max: u256                   # Maximum bet amount
    prize_pool: u256                # Total XP in the pool
    joke_prompt: str                # AI-generated joke setup
    winning_submission_id: i32      # Anonymous ID of winning submission
    winning_author: str             # Address of winner (revealed after judging)
    
    # Timestamps (block numbers for simplicity)
    created_at: u256
    submission_deadline: u256
    betting_deadline: u256


# ============================================================================
# EVENTS
# ============================================================================

class GameCreated(gl.Event):
    """Emitted when a new game room is created"""
    def __init__(self, game_id: str, host: str, /):
        pass


class PlayerJoined(gl.Event):
    """Emitted when a player joins a game"""
    def __init__(self, game_id: str, player: str, /):
        pass


class GameStarted(gl.Event):
    """Emitted when game transitions to submission phase"""
    def __init__(self, game_id: str, joke_prompt: str, /):
        pass


class SubmissionReceived(gl.Event):
    """Emitted when a player submits a punchline"""
    def __init__(self, game_id: str, anonymous_id: i32, /):
        pass


class BettingPhaseStarted(gl.Event):
    """Emitted when betting phase begins"""
    def __init__(self, game_id: str, submission_count: i32, /):
        pass


class BetPlaced(gl.Event):
    """Emitted when a player places a bet"""
    def __init__(self, game_id: str, player: str, amount: u256, /):
        pass


class GameFinished(gl.Event):
    """Emitted when game concludes with results"""
    def __init__(
        self, 
        game_id: str, 
        winning_submission_id: i32,
        winning_author: str,
        prize_pool: u256, 
        /
    ):
        pass


class XPDistributed(gl.Event):
    """Emitted when XP is distributed to a player"""
    def __init__(self, player: str, amount: u256, reason: str, /):
        pass


# ============================================================================
# MAIN CONTRACT
# ============================================================================

class OracleOfWit(gl.Contract):
    """
    Oracle of Wit - Multiplayer AI Humor Prediction Game
    
    Core mechanics:
    - Players submit punchlines to AI-generated joke prompts
    - Players bet on which submission AI will rank funniest
    - AI consensus determines winner via Optimistic Democracy
    - XP rewards distributed based on authorship and prediction accuracy
    """
    
    # Contract owner
    owner: str
    
    # Game rooms indexed by game_id
    games: TreeMap[str, GameRoom]
    
    # Players in each game: game_id -> list of player addresses
    game_players: TreeMap[str, DynArray[str]]
    
    # Submissions for each game: game_id -> list of submissions
    game_submissions: TreeMap[str, DynArray[Submission]]
    
    # Bets for each game: game_id -> list of bets
    game_bets: TreeMap[str, DynArray[Bet]]
    
    # Player balances (internal XP tracking)
    balances: TreeMap[str, u256]
    
    # Global leaderboard
    leaderboard: TreeMap[str, PlayerScore]
    
    # Game counter for unique IDs
    game_counter: u256
    
    # Current week number for leaderboard resets
    current_week: u256
    
    # Configuration
    author_bonus_multiplier: u256      # Bonus for winning author (e.g., 2x)
    predictor_share_percent: u256      # % of pool for correct predictors
    min_players_default: i32
    max_players_default: i32

    def __init__(self):
        """Initialize the Oracle of Wit contract"""
        self.owner = gl.message.sender_address.as_hex
        self.game_counter = u256(0)
        self.current_week = u256(1)
        
        # Default configuration
        self.author_bonus_multiplier = u256(150)  # 1.5x (stored as 150/100)
        self.predictor_share_percent = u256(70)   # 70% of pool to predictors
        self.min_players_default = i32(2)         # Min 2 for testing, recommend 4
        self.max_players_default = i32(10)

    # ========================================================================
    # PLAYER BALANCE MANAGEMENT
    # ========================================================================
    
    @gl.public.write.payable
    def deposit_xp(self) -> u256:
        """
        Deposit native tokens as XP balance.
        Players must have XP to place bets.
        """
        sender = gl.message.sender_address.as_hex
        amount = gl.message.value
        
        if amount == u256(0):
            raise Exception("Must deposit a positive amount")
        
        current_balance = self.balances.get(sender, u256(0))
        self.balances[sender] = current_balance + amount
        
        return self.balances[sender]

    @gl.public.write
    def withdraw_xp(self, amount: int) -> u256:
        """Withdraw XP as native tokens"""
        sender = gl.message.sender_address.as_hex
        withdraw_amount = u256(amount)
        
        current_balance = self.balances.get(sender, u256(0))
        if current_balance < withdraw_amount:
            raise Exception("Insufficient balance")
        
        self.balances[sender] = current_balance - withdraw_amount
        
        # Transfer native tokens back to sender
        gl.message.sender_address.transfer(withdraw_amount)
        
        return self.balances[sender]

    @gl.public.view
    def get_balance(self, player: str) -> int:
        """Get a player's XP balance"""
        return int(self.balances.get(player, u256(0)))

    # ========================================================================
    # GAME ROOM MANAGEMENT
    # ========================================================================

    @gl.public.write
    def create_game(
        self,
        min_players: int = 2,
        max_players: int = 10,
        bet_min: int = 10,
        bet_max: int = 100
    ) -> str:
        """
        Create a new game room.
        
        Args:
            min_players: Minimum players to start (2-10)
            max_players: Maximum players allowed (2-10)
            bet_min: Minimum bet amount in XP
            bet_max: Maximum bet amount in XP
            
        Returns:
            game_id: Unique identifier for the game
        """
        sender = gl.message.sender_address.as_hex
        
        # Validate parameters
        if min_players < 2 or min_players > 10:
            raise Exception("min_players must be 2-10")
        if max_players < min_players or max_players > 10:
            raise Exception("max_players must be >= min_players and <= 10")
        if bet_min <= 0 or bet_max < bet_min:
            raise Exception("Invalid bet range")
        
        # Generate unique game ID
        self.game_counter = self.game_counter + u256(1)
        game_id = f"GAME_{int(self.game_counter)}"
        
        # Create game room
        game = GameRoom(
            game_id=game_id,
            host=sender,
            status="waiting",
            min_players=i32(min_players),
            max_players=i32(max_players),
            bet_min=u256(bet_min),
            bet_max=u256(bet_max),
            prize_pool=u256(0),
            joke_prompt="",
            winning_submission_id=i32(-1),
            winning_author="",
            created_at=u256(0),  # Would use block.timestamp in production
            submission_deadline=u256(0),
            betting_deadline=u256(0)
        )
        
        self.games[game_id] = game
        
        # Initialize player list and add host
        # Note: Using explicit storage allocation pattern
        self.game_players[game_id] = gl.storage.inmem_allocate(DynArray[str])
        self.game_players[game_id].append(sender)
        
        # Initialize empty submissions and bets arrays
        self.game_submissions[game_id] = gl.storage.inmem_allocate(DynArray[Submission])
        self.game_bets[game_id] = gl.storage.inmem_allocate(DynArray[Bet])
        
        GameCreated(game_id, sender)
        PlayerJoined(game_id, sender)
        
        return game_id

    @gl.public.write
    def join_game(self, game_id: str) -> bool:
        """
        Join an existing game room.
        
        Args:
            game_id: The game to join
            
        Returns:
            success: Whether join was successful
        """
        sender = gl.message.sender_address.as_hex
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.status != "waiting":
            raise Exception("Game already started")
        
        players = self.game_players.get(game_id, None)
        if players is None:
            raise Exception("Game data corrupted")
        
        # Check if already joined
        for i in range(len(players)):
            if players[i] == sender:
                raise Exception("Already in game")
        
        # Check max players
        if len(players) >= int(game.max_players):
            raise Exception("Game is full")
        
        players.append(sender)
        
        PlayerJoined(game_id, sender)
        
        return True

    @gl.public.write
    def start_game(self, game_id: str) -> str:
        """
        Start the game - generates AI joke prompt.
        Only host can start, requires minimum players.
        
        This triggers a NON-DETERMINISTIC LLM call that will be
        validated via Optimistic Democracy consensus.
        
        Args:
            game_id: The game to start
            
        Returns:
            joke_prompt: The AI-generated joke setup
        """
        sender = gl.message.sender_address.as_hex
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.host != sender:
            raise Exception("Only host can start game")
        
        if game.status != "waiting":
            raise Exception("Game already started")
        
        players = self.game_players.get(game_id, None)
        if players is None or len(players) < int(game.min_players):
            raise Exception(f"Need at least {game.min_players} players")
        
        # Generate joke prompt via LLM
        # This is NON-DETERMINISTIC and uses eq_principle_prompt_non_comparative
        # for subjective content validation
        joke_prompt = self._generate_joke_prompt()
        
        # Update game state
        game.status = "submitting"
        game.joke_prompt = joke_prompt
        self.games[game_id] = game
        
        GameStarted(game_id, joke_prompt)
        
        return joke_prompt

    @gl.public.write
    def submit_punchline(self, game_id: str, punchline: str) -> i32:
        """
        Submit a punchline for the current joke prompt.
        
        Args:
            game_id: The game ID
            punchline: Your witty punchline (max 200 chars)
            
        Returns:
            anonymous_id: Your submission's anonymous ID
        """
        sender = gl.message.sender_address.as_hex
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.status != "submitting":
            raise Exception("Not in submission phase")
        
        # Validate punchline
        if len(punchline) == 0:
            raise Exception("Punchline cannot be empty")
        if len(punchline) > 200:
            raise Exception("Punchline too long (max 200 chars)")
        
        # Check player is in game
        players = self.game_players.get(game_id, None)
        if players is None:
            raise Exception("Game data corrupted")
        
        is_player = False
        for i in range(len(players)):
            if players[i] == sender:
                is_player = True
                break
        
        if not is_player:
            raise Exception("Not a player in this game")
        
        # Check for duplicate submission
        submissions = self.game_submissions.get(game_id, None)
        if submissions is None:
            raise Exception("Game data corrupted")
        
        for i in range(len(submissions)):
            if submissions[i].author == sender:
                raise Exception("Already submitted")
        
        # Generate anonymous ID (1 to N)
        anonymous_id = i32(len(submissions) + 1)
        
        # Create submission
        submission = Submission(
            author=sender,
            text=punchline,
            anonymous_id=anonymous_id
        )
        
        submissions.append(submission)
        
        SubmissionReceived(game_id, anonymous_id)
        
        return anonymous_id

    @gl.public.write
    def start_betting_phase(self, game_id: str) -> int:
        """
        Transition to betting phase after submissions.
        Host can call this, or auto-trigger when all players submitted.
        
        Args:
            game_id: The game ID
            
        Returns:
            submission_count: Number of submissions
        """
        sender = gl.message.sender_address.as_hex
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.status != "submitting":
            raise Exception("Not in submission phase")
        
        submissions = self.game_submissions.get(game_id, None)
        if submissions is None or len(submissions) < 2:
            raise Exception("Need at least 2 submissions")
        
        # Only host can force start betting
        if game.host != sender:
            # Check if all players submitted
            players = self.game_players.get(game_id, None)
            if players is None or len(submissions) < len(players):
                raise Exception("Only host can start betting early")
        
        game.status = "betting"
        self.games[game_id] = game
        
        BettingPhaseStarted(game_id, i32(len(submissions)))
        
        return len(submissions)

    @gl.public.write
    def place_bet(self, game_id: str, submission_id: int, amount: int) -> bool:
        """
        Place a bet on which submission will be ranked #1.
        
        Args:
            game_id: The game ID
            submission_id: Anonymous ID of submission you're betting on
            amount: XP amount to wager
            
        Returns:
            success: Whether bet was placed
        """
        sender = gl.message.sender_address.as_hex
        bet_amount = u256(amount)
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.status != "betting":
            raise Exception("Not in betting phase")
        
        # Validate bet amount
        if bet_amount < game.bet_min or bet_amount > game.bet_max:
            raise Exception(f"Bet must be between {game.bet_min} and {game.bet_max}")
        
        # Check player has sufficient balance
        player_balance = self.balances.get(sender, u256(0))
        if player_balance < bet_amount:
            raise Exception("Insufficient XP balance")
        
        # Validate submission exists
        submissions = self.game_submissions.get(game_id, None)
        if submissions is None:
            raise Exception("Game data corrupted")
        
        valid_id = False
        for i in range(len(submissions)):
            if int(submissions[i].anonymous_id) == submission_id:
                valid_id = True
                break
        
        if not valid_id:
            raise Exception("Invalid submission ID")
        
        # Check player is in game
        players = self.game_players.get(game_id, None)
        if players is None:
            raise Exception("Game data corrupted")
        
        is_player = False
        for i in range(len(players)):
            if players[i] == sender:
                is_player = True
                break
        
        if not is_player:
            raise Exception("Not a player in this game")
        
        # Check for existing bet
        bets = self.game_bets.get(game_id, None)
        if bets is None:
            raise Exception("Game data corrupted")
        
        for i in range(len(bets)):
            if bets[i].player == sender:
                raise Exception("Already placed a bet")
        
        # Deduct from balance and add to pool
        self.balances[sender] = player_balance - bet_amount
        game.prize_pool = game.prize_pool + bet_amount
        self.games[game_id] = game
        
        # Record bet
        bet = Bet(
            player=sender,
            submission_id=i32(submission_id),
            amount=bet_amount
        )
        bets.append(bet)
        
        BetPlaced(game_id, sender, bet_amount)
        
        return True

    @gl.public.write
    def finalize_judging(self, game_id: str) -> typing.Any:
        """
        Execute AI judging to rank submissions and distribute rewards.
        
        This is the CORE SHOWCASE of GenLayer's capabilities:
        - Non-deterministic LLM call for subjective humor ranking
        - Optimistic Democracy consensus on the ranking
        - Automatic XP distribution based on results
        
        Args:
            game_id: The game ID
            
        Returns:
            result: Dict with winner info and rankings
        """
        sender = gl.message.sender_address.as_hex
        
        game = self.games.get(game_id, None)
        if game is None:
            raise Exception("Game not found")
        
        if game.status != "betting":
            raise Exception("Not ready for judging")
        
        submissions = self.game_submissions.get(game_id, None)
        if submissions is None or len(submissions) < 2:
            raise Exception("Not enough submissions")
        
        bets = self.game_bets.get(game_id, None)
        if bets is None:
            raise Exception("Game data corrupted")
        
        # Build submission list for ranking
        submission_list = []
        for i in range(len(submissions)):
            sub = submissions[i]
            submission_list.append({
                "id": int(sub.anonymous_id),
                "text": sub.text
            })
        
        # Execute AI ranking - NON-DETERMINISTIC with consensus
        ranking = self._rank_submissions(game.joke_prompt, submission_list)
        
        # The ranking is a list of submission IDs from funniest to least funny
        # ranking[0] is the winner
        winning_id = ranking[0]
        
        # Find winning submission and author
        winning_author = ""
        for i in range(len(submissions)):
            if int(submissions[i].anonymous_id) == winning_id:
                winning_author = submissions[i].author
                break
        
        # Update game state
        game.status = "finished"
        game.winning_submission_id = i32(winning_id)
        game.winning_author = winning_author
        self.games[game_id] = game
        
        # Distribute rewards
        self._distribute_rewards(game_id, winning_id, winning_author)
        
        # Update leaderboard
        self._update_leaderboard(game_id, winning_author)
        
        GameFinished(game_id, i32(winning_id), winning_author, game.prize_pool)
        
        return {
            "winning_submission_id": winning_id,
            "winning_author": winning_author,
            "full_ranking": ranking,
            "prize_pool": int(game.prize_pool)
        }

    # ========================================================================
    # AI FUNCTIONS (Non-Deterministic)
    # ========================================================================

    def _generate_joke_prompt(self) -> str:
        """
        Generate a creative joke setup prompt using LLM.
        
        Uses eq_principle_prompt_non_comparative because:
        - The output is creative/subjective content
        - Validators check that the result meets quality criteria
        - Different LLMs may produce different but equally valid prompts
        """
        prompt = """You are a comedy writer for a multiplayer game. Generate ONE fresh, 
funny open-ended joke setup that players will complete with punchlines.

Requirements:
- The setup should be 1-3 sentences
- It should naturally lead to a punchline
- Be creative - avoid clichés
- The format should invite witty completions
- Keep it family-friendly but clever

Example formats:
- "An AI, a philosopher, and a cat walk into a bar. The bartender says..."
- "Scientists discovered that the meaning of life is actually..."
- "The first words spoken by a sentient toaster were..."

Respond with ONLY the joke setup text, nothing else. No quotes, no labels."""

        def generate():
            result = gl.exec_prompt(prompt)
            return result.strip()
        
        # Non-comparative: validators verify the output is a valid joke setup
        task = "Generate a creative, open-ended joke setup for a multiplayer game"
        criteria = """The output must be:
1. A coherent joke setup (1-3 sentences)
2. Open-ended, inviting punchline completions
3. Creative and engaging
4. Family-friendly content
5. Not just repeating the example formats"""
        
        return gl.eq_principle_prompt_non_comparative(
            generate,
            task=task,
            criteria=criteria
        )

    def _rank_submissions(
        self, 
        joke_prompt: str, 
        submissions: list
    ) -> list:
        """
        Use AI to rank submissions by humor/creativity.
        
        Uses eq_principle_prompt_comparative because:
        - Multiple validators independently rank the submissions
        - They compare rankings using the equivalence principle
        - Consensus ensures fair, decentralized judgment
        
        This is the CORE innovation: subjective AI judgment with blockchain consensus.
        """
        # Build the submission text for the prompt
        submissions_text = "\n".join([
            f"ID {s['id']}: \"{s['text']}\""
            for s in submissions
        ])
        
        prompt = f"""You are judging a comedy competition. Players submitted punchlines 
to complete this joke setup:

JOKE SETUP: "{joke_prompt}"

SUBMISSIONS:
{submissions_text}

Rank ALL submissions from FUNNIEST (#1) to least funny. Consider:
- Wit and cleverness
- Surprise/unexpected humor
- How well it fits the setup
- Creativity and originality

You MUST rank every submission. Respond with ONLY a JSON array of submission IDs 
in order from funniest to least funny.

Example response format: [3, 1, 5, 2, 4]

Your response (JSON array only, no other text):"""

        def rank():
            result = gl.exec_prompt(prompt)
            # Clean up response
            result = result.strip()
            result = result.replace("```json", "").replace("```", "").strip()
            
            # Parse and validate
            ranking = json.loads(result)
            
            # Ensure it's a list of integers
            if not isinstance(ranking, list):
                raise Exception("Invalid ranking format")
            
            ranking = [int(x) for x in ranking]
            
            # Verify all IDs are present
            expected_ids = set(s['id'] for s in submissions)
            if set(ranking) != expected_ids:
                raise Exception("Ranking missing some submissions")
            
            return json.dumps(ranking)  # Return as JSON string for comparison
        
        # Comparative: validators compare their rankings
        principle = """Both rankings should identify the same submission as funniest (#1).
The top-ranked submission must be the same, though minor differences in lower ranks 
are acceptable. The key criterion is agreement on the winner."""
        
        result_json = gl.eq_principle_prompt_comparative(rank, principle)
        
        return json.loads(result_json)

    # ========================================================================
    # REWARD DISTRIBUTION
    # ========================================================================

    def _distribute_rewards(
        self, 
        game_id: str, 
        winning_id: int,
        winning_author: str
    ):
        """
        Distribute XP rewards after judging:
        - Winning author gets bonus
        - Correct predictors share the pool
        - Incorrect bettors lose their stake
        """
        game = self.games.get(game_id, None)
        if game is None:
            return
        
        bets = self.game_bets.get(game_id, None)
        if bets is None:
            return
        
        prize_pool = game.prize_pool
        
        # Calculate pool splits
        # predictor_share_percent of pool goes to correct predictors
        # Rest goes to winning author
        predictor_pool = (prize_pool * self.predictor_share_percent) // u256(100)
        author_bonus = prize_pool - predictor_pool
        
        # Find correct predictors
        correct_predictors = []
        total_correct_bet = u256(0)
        
        for i in range(len(bets)):
            bet = bets[i]
            if int(bet.submission_id) == winning_id:
                correct_predictors.append(bet)
                total_correct_bet = total_correct_bet + bet.amount
        
        # Distribute to correct predictors (proportional to their bet)
        if len(correct_predictors) > 0 and total_correct_bet > u256(0):
            for bet in correct_predictors:
                # Return original bet + share of predictor pool
                share = (predictor_pool * bet.amount) // total_correct_bet
                payout = bet.amount + share
                
                current = self.balances.get(bet.player, u256(0))
                self.balances[bet.player] = current + payout
                
                XPDistributed(bet.player, payout, "correct_prediction")
        else:
            # No correct predictions - author gets entire pool
            author_bonus = prize_pool
        
        # Pay the winning author
        if winning_author != "":
            current = self.balances.get(winning_author, u256(0))
            self.balances[winning_author] = current + author_bonus
            
            XPDistributed(winning_author, author_bonus, "winning_submission")

    def _update_leaderboard(self, game_id: str, winning_author: str):
        """Update global leaderboard with game results"""
        game = self.games.get(game_id, None)
        if game is None:
            return
        
        players = self.game_players.get(game_id, None)
        bets = self.game_bets.get(game_id, None)
        
        if players is None or bets is None:
            return
        
        winning_id = int(game.winning_submission_id)
        
        # Update all players
        for i in range(len(players)):
            player = players[i]
            score = self.leaderboard.get(player, None)
            
            if score is None:
                score = PlayerScore(
                    address=player,
                    total_xp=u256(0),
                    wins_as_author=u256(0),
                    correct_predictions=u256(0),
                    games_played=u256(0),
                    last_active_week=self.current_week
                )
            
            score.games_played = score.games_played + u256(1)
            score.last_active_week = self.current_week
            
            # Check if this player was the winning author
            if player == winning_author:
                score.wins_as_author = score.wins_as_author + u256(1)
            
            # Check if this player made a correct prediction
            for j in range(len(bets)):
                bet = bets[j]
                if bet.player == player and int(bet.submission_id) == winning_id:
                    score.correct_predictions = score.correct_predictions + u256(1)
                    break
            
            # Update total XP from balance
            score.total_xp = self.balances.get(player, u256(0))
            
            self.leaderboard[player] = score

    # ========================================================================
    # VIEW FUNCTIONS
    # ========================================================================

    @gl.public.view
    def get_game_state(self, game_id: str) -> typing.Any:
        """Get complete state of a game"""
        game = self.games.get(game_id, None)
        if game is None:
            return None
        
        players = self.game_players.get(game_id, None)
        submissions = self.game_submissions.get(game_id, None)
        bets = self.game_bets.get(game_id, None)
        
        player_list = []
        if players is not None:
            for i in range(len(players)):
                player_list.append(players[i])
        
        # Only show anonymous submissions during betting
        submission_list = []
        if submissions is not None:
            for i in range(len(submissions)):
                sub = submissions[i]
                if game.status in ["betting", "judging"]:
                    # Anonymous during betting
                    submission_list.append({
                        "anonymous_id": int(sub.anonymous_id),
                        "text": sub.text
                    })
                elif game.status == "finished":
                    # Reveal authors after game ends
                    submission_list.append({
                        "anonymous_id": int(sub.anonymous_id),
                        "text": sub.text,
                        "author": sub.author
                    })
        
        return {
            "game_id": game.game_id,
            "host": game.host,
            "status": game.status,
            "joke_prompt": game.joke_prompt,
            "players": player_list,
            "player_count": len(player_list),
            "submission_count": len(submission_list),
            "submissions": submission_list,
            "bet_count": len(bets) if bets else 0,
            "prize_pool": int(game.prize_pool),
            "bet_min": int(game.bet_min),
            "bet_max": int(game.bet_max),
            "winning_submission_id": int(game.winning_submission_id),
            "winning_author": game.winning_author
        }

    @gl.public.view
    def get_anonymous_submissions(self, game_id: str) -> typing.Any:
        """Get submissions with only anonymous IDs (for betting phase)"""
        game = self.games.get(game_id, None)
        if game is None:
            return []
        
        submissions = self.game_submissions.get(game_id, None)
        if submissions is None:
            return []
        
        result = []
        for i in range(len(submissions)):
            sub = submissions[i]
            result.append({
                "id": int(sub.anonymous_id),
                "text": sub.text
            })
        
        return result

    @gl.public.view
    def get_player_score(self, player: str) -> typing.Any:
        """Get a player's leaderboard stats"""
        score = self.leaderboard.get(player, None)
        if score is None:
            return {
                "address": player,
                "total_xp": 0,
                "wins_as_author": 0,
                "correct_predictions": 0,
                "games_played": 0
            }
        
        return {
            "address": score.address,
            "total_xp": int(score.total_xp),
            "wins_as_author": int(score.wins_as_author),
            "correct_predictions": int(score.correct_predictions),
            "games_played": int(score.games_played)
        }

    @gl.public.view
    def get_active_games(self) -> typing.Any:
        """Get list of games that are waiting for players"""
        # Note: In production, would implement proper iteration
        # For now, return instruction to check specific game IDs
        return {
            "total_games_created": int(self.game_counter),
            "note": "Query individual games with get_game_state(game_id)"
        }

    # ========================================================================
    # ADMIN FUNCTIONS
    # ========================================================================

    @gl.public.write
    def set_config(
        self,
        author_multiplier: int,
        predictor_share: int
    ) -> bool:
        """Update contract configuration (owner only)"""
        if gl.message.sender_address.as_hex != self.owner:
            raise Exception("Only owner can configure")
        
        if predictor_share > 100:
            raise Exception("Predictor share cannot exceed 100%")
        
        self.author_bonus_multiplier = u256(author_multiplier)
        self.predictor_share_percent = u256(predictor_share)
        
        return True

    @gl.public.write
    def advance_week(self) -> u256:
        """
        Advance the week counter for leaderboard tracking.
        Could be automated with a keeper in production.
        """
        if gl.message.sender_address.as_hex != self.owner:
            raise Exception("Only owner can advance week")
        
        self.current_week = self.current_week + u256(1)
        return self.current_week

    @gl.public.view
    def get_contract_info(self) -> typing.Any:
        """Get contract configuration and stats"""
        return {
            "owner": self.owner,
            "total_games": int(self.game_counter),
            "current_week": int(self.current_week),
            "author_bonus_multiplier": int(self.author_bonus_multiplier),
            "predictor_share_percent": int(self.predictor_share_percent),
            "contract_balance": int(gl.this_contract.balance)
        }
