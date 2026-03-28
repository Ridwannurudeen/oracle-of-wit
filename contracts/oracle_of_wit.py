# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import typing

class OracleOfWit(gl.Contract):
    """
    Oracle of Wit - Comedy Judging Intelligent Contract

    Uses GenLayer's Optimistic Democracy for trustless AI comedy judging.
    Multiple AI validators independently pick the funniest punchline and
    must reach consensus via the Equivalence Principle.

    Two-block judging pattern:
      Block 1 (comparative): Pick winner — all validators must agree
      Block 2 (non-comparative): Generate roasts — leader runs, validators grade

    Storage is minimal (counters only) — game state lives in Redis.
    GenLayer handles the AI consensus that Redis can't do.

    Note: TreeMap[str, ...] is not yet supported on Bradbury testnet.
    Leaderboard, profiles, and game history are managed by Redis + the
    backend until TreeMap support stabilizes.
    """

    # Storage — only primitive types that work on Bradbury
    total_games: u32
    total_judgments: u32
    total_appeals: u32
    current_game_id: str
    current_game_data: str
    current_round_submissions: str
    current_round_result: str
    last_finalized_game: str

    # 2A — On-Chain Player Stats (top 3)
    top_player_1: str  # JSON: {name, total_xp, games_won, games_played}
    top_player_2: str
    top_player_3: str

    # 2B — Weekly Leaderboard Snapshot
    weekly_snapshot: str       # JSON: top 10 players + week identifier
    weekly_snapshot_week: str  # "2026-W13" format

    # 2C — Verifiable Game History (rolling last 5)
    game_history_1: str
    game_history_2: str
    game_history_3: str
    game_history_4: str
    game_history_5: str

    # 2D — Achievement Verification Flags
    achievement_flags: u32
    achievement_player: str

    def __init__(self):
        """Initialize the Oracle of Wit contract"""
        self.total_games = 0
        self.total_judgments = 0
        self.total_appeals = 0
        self.current_game_id = ""
        self.current_game_data = ""
        self.current_round_submissions = ""
        self.current_round_result = ""
        self.last_finalized_game = ""
        # 2A — On-Chain Player Stats
        self.top_player_1 = ""
        self.top_player_2 = ""
        self.top_player_3 = ""
        # 2B — Weekly Leaderboard Snapshot
        self.weekly_snapshot = ""
        self.weekly_snapshot_week = ""
        # 2C — Verifiable Game History
        self.game_history_1 = ""
        self.game_history_2 = ""
        self.game_history_3 = ""
        self.game_history_4 = ""
        self.game_history_5 = ""
        # 2D — Achievement Verification Flags
        self.achievement_flags = 0
        self.achievement_player = ""

    @gl.public.view
    def get_stats(self) -> typing.Any:
        """Get contract statistics"""
        top_players_count = sum(1 for s in [self.top_player_1, self.top_player_2, self.top_player_3] if s)
        return {
            "total_games": self.total_games,
            "total_judgments": self.total_judgments,
            "total_appeals": self.total_appeals,
            "current_game_id": self.current_game_id,
            "top_players_count": top_players_count,
            "weekly_snapshot_week": self.weekly_snapshot_week,
            "achievement_player": self.achievement_player,
            "achievement_flags": self.achievement_flags
        }

    @gl.public.view
    def get_game(self, game_id: str) -> typing.Any:
        """Get current game state if it matches the active game"""
        if self.current_game_id != game_id:
            return {"error": "Game not found or not active"}
        return {
            "game_id": self.current_game_id,
            "game_data": self.current_game_data,
            "round_submissions": self.current_round_submissions,
            "round_result": self.current_round_result
        }

    @gl.public.write
    def create_game(
        self,
        game_id: str,
        host: str,
        category: str,
        num_rounds: int,
        players_json: str
    ) -> typing.Any:
        """Register a new game on-chain"""
        self.total_games += 1
        self.current_game_id = game_id
        self.current_game_data = json.dumps({
            "host": host,
            "category": category,
            "num_rounds": num_rounds,
            "status": "active",
            "players": json.loads(players_json),
            "created_at": game_id
        })
        self.current_round_submissions = ""
        self.current_round_result = ""
        return {
            "game_id": game_id,
            "total_games": self.total_games
        }

    @gl.public.write
    def register_round(
        self,
        game_id: str,
        round_num: int,
        joke_setup: str,
        submissions_json: str
    ) -> typing.Any:
        """Batch-record all submissions for a round"""
        self.current_round_submissions = json.dumps({
            "game_id": game_id,
            "round_num": round_num,
            "joke_setup": joke_setup,
            "submissions": json.loads(submissions_json)
        })
        return {
            "game_id": game_id,
            "round_num": round_num,
            "recorded": True
        }

    @gl.public.write
    def record_result(
        self,
        game_id: str,
        round_num: int,
        winner_id: int,
        winner_name: str,
        scores_json: str,
        judging_method: str
    ) -> typing.Any:
        """Record the outcome of a round"""
        self.current_round_result = json.dumps({
            "game_id": game_id,
            "round_num": round_num,
            "winner_id": winner_id,
            "winner_name": winner_name,
            "scores": json.loads(scores_json),
            "judging_method": judging_method
        })
        return {
            "game_id": game_id,
            "round_num": round_num,
            "winner_id": winner_id,
            "recorded": True
        }

    @gl.public.write
    def finalize_game(
        self,
        game_id: str,
        winner_name: str,
        final_standings_json: str
    ) -> typing.Any:
        """Finalize a game and record final standings"""
        finalized_data = json.dumps({
            "game_id": game_id,
            "winner_name": winner_name,
            "final_standings": json.loads(final_standings_json),
            "status": "completed"
        })
        self.last_finalized_game = finalized_data
        # Shift game history: 5→discard, 4→5, 3→4, 2→3, 1→2, new→1
        self.game_history_5 = self.game_history_4
        self.game_history_4 = self.game_history_3
        self.game_history_3 = self.game_history_2
        self.game_history_2 = self.game_history_1
        self.game_history_1 = finalized_data
        # Update current game status
        if self.current_game_id == game_id:
            try:
                data = json.loads(self.current_game_data)
                data["status"] = "completed"
                self.current_game_data = json.dumps(data)
            except (json.JSONDecodeError, ValueError):
                pass
        return {
            "game_id": game_id,
            "winner_name": winner_name,
            "finalized": True
        }

    @gl.public.write
    def judge_round(
        self,
        game_id: str,
        joke_setup: str,
        category: str,
        submissions: str  # JSON array of {id, playerName, punchline}
    ) -> typing.Any:
        """
        Judge a round using Optimistic Democracy

        This is where the magic happens:
        - Multiple AI validators independently decide the funniest punchline
        - They must reach consensus using the Equivalence Principle
        - Result is trustless and verifiable on-chain
        """

        try:
            submissions_list = json.loads(submissions)
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for submissions")

        if len(submissions_list) == 0:
            raise Exception("No submissions to judge")

        if len(submissions_list) == 1:
            # Only one submission, automatic winner
            self.total_judgments += 1
            return {
                "winner_id": submissions_list[0]["id"],
                "winner_name": submissions_list[0]["playerName"],
                "winning_punchline": submissions_list[0]["punchline"],
                "consensus_method": "single_submission"
            }

        # Format submissions for AI evaluation
        submissions_text = "\n".join([
            f'[ID: {s["id"]}] "{s["punchline"]}"'
            for s in submissions_list
        ])

        # The AI judging task
        judging_prompt = f"""You are the Oracle of Wit, an impartial comedy judge.

JOKE SETUP: "{joke_setup}"
CATEGORY: {category}

SUBMITTED PUNCHLINES:
{submissions_text}

JUDGING CRITERIA:
1. Humor & comedic timing - Does it make you laugh?
2. Cleverness & wordplay - Is there a smart twist?
3. Relevance to setup - Does it complete the joke well?
4. Surprise factor - Is there an unexpected element?
5. Overall quality - Would this win a comedy competition?

IMPORTANT: You must pick exactly ONE winner.
Respond with ONLY the ID number of the funniest submission (just the number, nothing else)."""

        # Non-deterministic AI call with Equivalence Principle
        # Multiple validators will independently run this and must agree
        def judge_comedy() -> int:
            result = gl.nondet.exec_prompt(judging_prompt)
            # Extract just the number from the response
            try:
                winner_id = int(result.strip())
                # Validate it's a real submission ID
                valid_ids = [s["id"] for s in submissions_list]
                if winner_id in valid_ids:
                    return winner_id
                # If invalid, return first submission as fallback
                return submissions_list[0]["id"]
            except (ValueError, TypeError, KeyError):
                return submissions_list[0]["id"]

        # gl.eq_principle_prompt_comparative ensures all validators must return
        # the SAME winner ID for consensus to be reached.
        # If validators disagree, more are added until majority agrees.
        winner_id = gl.eq_principle.prompt_comparative(
            judge_comedy,
            principle="Both results must select the same winner ID number"
        )

        # Find the winning submission
        winner = None
        for s in submissions_list:
            if s["id"] == winner_id:
                winner = s
                break

        if winner is None:
            winner = submissions_list[0]

        # Update stats
        self.total_judgments += 1

        # Block 2: Generate commentary/roasts (non-comparative — leader runs, validators grade quality)
        commentary_prompt = f"""You are the Oracle of Wit, a savage comedy judge.
The winner of this round is submission #{winner["id"]} by {winner["playerName"]}.

JOKE SETUP: "{joke_setup}"
CATEGORY: {category}

SUBMITTED PUNCHLINES:
{submissions_text}

Write a witty 1-sentence comment about the winner, and a 1-sentence roast for each losing submission.

Respond with ONLY valid JSON (no markdown):
{{"winnerComment": "<1 witty sentence>", "roasts": {{{", ".join([f'"{s["id"]}": "<1 sentence>"' for s in submissions_list if s["id"] != winner["id"]])}}}}}"""

        def generate_commentary() -> str:
            result = gl.nondet.exec_prompt(commentary_prompt)
            return result.strip()

        try:
            commentary_raw = gl.eq_principle.prompt_non_comparative(
                generate_commentary,
                task="Generate witty commentary and roasts about comedy submissions",
                criteria="The commentary must be witty and relevant to the submissions"
            )
            try:
                commentary = json.loads(commentary_raw)
            except (json.JSONDecodeError, ValueError):
                commentary = {"winnerComment": None, "roasts": {}}
        except Exception:
            commentary = {"winnerComment": None, "roasts": {}}

        return {
            "winner_id": winner["id"],
            "winner_name": winner["playerName"],
            "winning_punchline": winner["punchline"],
            "consensus_method": "optimistic_democracy",
            "validators_agreed": True,
            "commentary": commentary
        }

    @gl.public.write
    def appeal_judgment(
        self,
        game_id: str,
        joke_setup: str,
        category: str,
        submissions: str,
        original_winner_id: int
    ) -> typing.Any:
        """
        Appeal a round judgment using Optimistic Democracy with re-evaluation.

        This triggers a fresh judgment with an explicit instruction to reconsider.
        OD naturally adds more validators for disputed transactions, making
        appeals inherently more rigorous than initial judgments.
        """
        try:
            submissions_list = json.loads(submissions)
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for submissions")

        if len(submissions_list) <= 1:
            return {
                "new_winner_id": submissions_list[0]["id"] if submissions_list else original_winner_id,
                "overturned": False,
                "consensus_method": "single_submission"
            }

        submissions_text = "\n".join([
            f'[ID: {s["id"]}] "{s["punchline"]}"'
            for s in submissions_list
        ])

        appeal_prompt = f"""You are the Oracle of Wit APPEAL COURT. A previous judgment is being challenged.

JOKE SETUP: "{joke_setup}"
CATEGORY: {category}
PREVIOUS WINNER: Submission #{original_winner_id}

SUBMITTED PUNCHLINES:
{submissions_text}

APPEAL INSTRUCTIONS:
This is a RE-EVALUATION. The previous result is being contested.
Judge with EXTRA scrutiny. Consider ALL submissions equally without bias toward the previous winner.
Focus especially on:
1. Humor quality and laugh-out-loud potential
2. Cleverness and unexpected twists
3. How well the punchline completes the setup
4. Overall comedic excellence

You must pick the OBJECTIVELY funniest submission.
Respond with ONLY the ID number of the funniest submission (just the number, nothing else)."""

        def judge_appeal() -> int:
            result = gl.nondet.exec_prompt(appeal_prompt)
            try:
                winner_id = int(result.strip())
                valid_ids = [s["id"] for s in submissions_list]
                if winner_id in valid_ids:
                    return winner_id
                return submissions_list[0]["id"]
            except (ValueError, TypeError, KeyError):
                return submissions_list[0]["id"]

        new_winner_id = gl.eq_principle.prompt_comparative(
            judge_appeal,
            principle="Both results must select the same winner ID number"
        )
        overturned = new_winner_id != original_winner_id

        self.total_judgments += 1
        self.total_appeals += 1

        new_winner_sub = None
        for s in submissions_list:
            if s["id"] == new_winner_id:
                new_winner_sub = s
                break

        return {
            "new_winner_id": new_winner_id,
            "new_winner_name": new_winner_sub["playerName"] if new_winner_sub else "Unknown",
            "new_winning_punchline": new_winner_sub["punchline"] if new_winner_sub else "",
            "overturned": overturned,
            "consensus_method": "optimistic_democracy_appeal"
        }

    # ── 2A — On-Chain Player Stats ──────────────────────────────────────

    @gl.public.write
    def update_player_stats(self, player_name: str, xp_earned: int, won: bool) -> typing.Any:
        """Update player stats and re-rank top 3"""
        # Load current top 3 into a list
        slots = [self.top_player_1, self.top_player_2, self.top_player_3]
        players = []
        for s in slots:
            if s:
                try:
                    players.append(json.loads(s))
                except (json.JSONDecodeError, ValueError):
                    pass

        # Find existing player or create new entry
        found = False
        for p in players:
            if p["name"] == player_name:
                p["total_xp"] += xp_earned
                p["games_played"] += 1
                if won:
                    p["games_won"] += 1
                found = True
                break

        if not found:
            players.append({
                "name": player_name,
                "total_xp": xp_earned,
                "games_won": 1 if won else 0,
                "games_played": 1
            })

        # Sort by total_xp descending, keep top 3
        players.sort(key=lambda p: p["total_xp"], reverse=True)
        top3 = players[:3]

        # Save back to storage
        self.top_player_1 = json.dumps(top3[0]) if len(top3) > 0 else ""
        self.top_player_2 = json.dumps(top3[1]) if len(top3) > 1 else ""
        self.top_player_3 = json.dumps(top3[2]) if len(top3) > 2 else ""

        return {"updated": player_name, "top_count": len(top3)}

    @gl.public.view
    def get_top_players(self) -> typing.Any:
        """Get the top 3 players"""
        result = []
        for s in [self.top_player_1, self.top_player_2, self.top_player_3]:
            if s:
                try:
                    result.append(json.loads(s))
                except (json.JSONDecodeError, ValueError):
                    pass
        return result

    # ── 2B — Weekly Leaderboard Snapshot ──────────────────────────────────

    @gl.public.write
    def finalize_weekly_snapshot(self, week_id: str, top_10_json: str) -> typing.Any:
        """Store a weekly leaderboard snapshot"""
        self.weekly_snapshot = json.dumps({
            "week_id": week_id,
            "top_10": json.loads(top_10_json)
        })
        self.weekly_snapshot_week = week_id
        return {"week_id": week_id, "stored": True}

    @gl.public.view
    def get_weekly_snapshot(self) -> typing.Any:
        """Get the latest weekly leaderboard snapshot"""
        if not self.weekly_snapshot:
            return {}
        try:
            return json.loads(self.weekly_snapshot)
        except (json.JSONDecodeError, ValueError):
            return {}

    # ── 2C — Verifiable Game History ──────────────────────────────────────

    @gl.public.view
    def get_game_history(self) -> typing.Any:
        """Get rolling history of last 5 finalized games"""
        result = []
        for s in [self.game_history_1, self.game_history_2, self.game_history_3,
                   self.game_history_4, self.game_history_5]:
            if s:
                try:
                    result.append(json.loads(s))
                except (json.JSONDecodeError, ValueError):
                    pass
        return result

    # ── 2D — Achievement Verification Flags ───────────────────────────────

    @gl.public.write
    def unlock_achievement(self, player_name: str, achievement_bit: int) -> typing.Any:
        """Unlock an achievement bit for a player. Resets flags if player changes."""
        if self.achievement_player != player_name:
            self.achievement_flags = 0
            self.achievement_player = player_name
        self.achievement_flags |= (1 << achievement_bit)
        return {
            "player": player_name,
            "achievement_bit": achievement_bit,
            "flags": self.achievement_flags
        }

    @gl.public.view
    def get_achievements(self, player_name: str) -> typing.Any:
        """Get achievement flags for a player"""
        if self.achievement_player == player_name:
            return self.achievement_flags
        return 0

    # ── Utility ───────────────────────────────────────────────────────────

    @gl.public.write
    def record_game_count(self) -> typing.Any:
        """Increment the total games counter"""
        self.total_games += 1
        return {"total_games": self.total_games}
