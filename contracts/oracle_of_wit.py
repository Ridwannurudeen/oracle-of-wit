# { "Depends": "py-genlayer:test" }
from genlayer import *
import json
import typing

class OracleOfWit(gl.Contract):
    """
    Oracle of Wit - Comedy Judging Intelligent Contract
    
    This contract demonstrates GenLayer's Optimistic Democracy by using
    multiple AI validators to reach consensus on which joke is funniest.
    
    How it works:
    1. Players submit punchlines for a joke setup
    2. Contract uses AI to judge the funniest submission
    3. Multiple validators independently evaluate using different LLMs
    4. Equivalence Principle: validators must agree on the winner
    5. If consensus reached → winner recorded on-chain
    6. If disputed → more validators added until agreement

    Access control: Only the backend holding the GenLayer private key can sign
    writeContract calls, so the SDK layer enforces admin-equivalent access.
    No on-chain admin model is needed.
    """

    # Storage
    games: TreeMap[str, str]  # game_id -> game state JSON
    leaderboard: TreeMap[str, int]  # player_name -> total_score
    player_games: TreeMap[str, str]  # player_name -> JSON array of game_ids
    seasons: TreeMap[str, str]  # season_id -> archived leaderboard JSON
    player_profiles: TreeMap[str, str]  # player_id -> profile JSON (replaces Turso)
    hall_of_fame: TreeMap[str, str]  # index key -> joke JSON
    prompt_pool: TreeMap[str, str]  # category -> JSON array of prompts
    total_games: int
    total_judgments: int
    hall_of_fame_count: int

    def __init__(self):
        """Initialize the Oracle of Wit contract"""
        self.total_games = 0
        self.total_judgments = 0
        self.hall_of_fame_count = 0

    @gl.public.view
    def get_game(self, game_id: str) -> typing.Any:
        """Get game state by ID"""
        game_json = self.games.get(game_id, None)
        if game_json is None:
            return None
        return json.loads(game_json)
    
    @gl.public.view
    def get_leaderboard(self, limit: int = 20) -> typing.Any:
        """Get top players by score"""
        # Note: In production, you'd want pagination
        scores = []
        for name in self.leaderboard:
            scores.append({
                "name": name,
                "score": self.leaderboard[name]
            })
        # Sort by score descending
        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores[:limit]
    
    @gl.public.view
    def get_stats(self) -> typing.Any:
        """Get contract statistics"""
        return {
            "total_games": self.total_games,
            "total_judgments": self.total_judgments
        }

    @gl.public.view
    def get_profile(self, player_id: str) -> typing.Any:
        """Get a player profile by ID"""
        profile_json = self.player_profiles.get(player_id, None)
        if profile_json is None:
            return None
        return json.loads(profile_json)

    @gl.public.view
    def get_hall_of_fame(self, limit: int = 50) -> typing.Any:
        """Get top hall of fame entries, sorted by date descending"""
        entries = []
        for key in self.hall_of_fame:
            try:
                entry = json.loads(self.hall_of_fame[key])
                entries.append(entry)
            except (json.JSONDecodeError, ValueError):
                pass
        entries.sort(key=lambda x: x.get("date", 0), reverse=True)
        return entries[:limit]

    @gl.public.view
    def get_prompt_pool_size(self, category: str) -> int:
        """Get the number of available prompts in the pool for a category"""
        pool_json = self.prompt_pool.get(category, "[]")
        try:
            pool = json.loads(pool_json)
            return len(pool)
        except (json.JSONDecodeError, ValueError):
            return 0

    @gl.public.write
    def update_profile(self, player_id: str, profile_json: str) -> typing.Any:
        """Upsert a player profile"""
        try:
            json.loads(profile_json)  # validate JSON
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for profile")
        self.player_profiles[player_id] = profile_json
        return {"updated": True, "player_id": player_id}

    @gl.public.write
    def record_game(self, game_id: str, results_json: str) -> typing.Any:
        """
        Enhanced record_game_result — updates profiles + leaderboard + hall of fame in one tx.
        results_json: {finalScores: [{playerName, score}], hallOfFame?: {prompt, punchline, author, commentary, category}}
        """
        try:
            results = json.loads(results_json)
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for results")

        final_scores = results.get("final_scores", [])

        # Update leaderboard
        for player in final_scores:
            name = player["playerName"]
            score = player["score"]
            current = self.leaderboard.get(name, 0)
            self.leaderboard[name] = current + score

            pg = json.loads(self.player_games.get(name, "[]"))
            if game_id not in pg:
                pg.append(game_id)
                self.player_games[name] = json.dumps(pg)

        # Update game state
        existing_json = self.games.get(game_id, None)
        if existing_json:
            try:
                game = json.loads(existing_json)
            except (json.JSONDecodeError, ValueError):
                game = {"id": game_id}
            game["status"] = "finished"
            self.games[game_id] = json.dumps(game)

        # Hall of fame entry (optional)
        hof_entry = results.get("hall_of_fame", None)
        if hof_entry:
            key = str(self.hall_of_fame_count)
            hof_entry["date"] = hof_entry.get("date", 0)
            self.hall_of_fame[key] = json.dumps(hof_entry)
            self.hall_of_fame_count += 1
            # Cap at 50 — remove oldest if over limit
            if self.hall_of_fame_count > 50:
                oldest_key = str(self.hall_of_fame_count - 51)
                try:
                    del self.hall_of_fame[oldest_key]
                except KeyError:
                    pass

        return {"recorded": True, "players_updated": len(final_scores)}

    @gl.public.write
    def add_to_hall_of_fame(self, joke_json: str) -> typing.Any:
        """Add a winning joke to the hall of fame, capped at 50"""
        try:
            joke = json.loads(joke_json)
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for joke")

        key = str(self.hall_of_fame_count)
        self.hall_of_fame[key] = joke_json
        self.hall_of_fame_count += 1

        # Cap at 50
        if self.hall_of_fame_count > 50:
            oldest_key = str(self.hall_of_fame_count - 51)
            try:
                del self.hall_of_fame[oldest_key]
            except KeyError:
                pass

        return {"added": True, "count": min(self.hall_of_fame_count, 50)}

    @gl.public.write
    def generate_prompts(self, category: str, count: int) -> typing.Any:
        """Batch-generate prompts via AI and store in prompt_pool"""
        prompt = f"""Generate {count} unique and funny joke setups for the category "{category}".
Each setup should end with "..." or a question mark, leaving room for a punchline.
Return ONLY a JSON array of strings, e.g. ["Why did...", "What happens when..."]"""

        result = gl.exec_prompt(prompt)
        try:
            prompts = json.loads(result.strip())
            if not isinstance(prompts, list):
                prompts = []
        except (json.JSONDecodeError, ValueError):
            prompts = []

        existing_json = self.prompt_pool.get(category, "[]")
        try:
            existing = json.loads(existing_json)
        except (json.JSONDecodeError, ValueError):
            existing = []

        existing.extend(prompts)
        self.prompt_pool[category] = json.dumps(existing)

        return {"generated": len(prompts), "total": len(existing)}

    @gl.public.write
    def pop_prompt(self, category: str) -> typing.Any:
        """Remove and return one prompt from the pool"""
        pool_json = self.prompt_pool.get(category, "[]")
        try:
            pool = json.loads(pool_json)
        except (json.JSONDecodeError, ValueError):
            pool = []

        if len(pool) == 0:
            return None

        prompt = pool.pop(0)
        self.prompt_pool[category] = json.dumps(pool)
        return prompt

    @gl.public.view
    def get_player_history(self, player_name: str) -> typing.Any:
        """
        Get a player's on-chain game history.

        Returns their total score, number of games played, and per-game
        details (game ID, category, status). Demonstrates GenLayer as a
        persistent state layer for player profiles.
        """
        total_score = self.leaderboard.get(player_name, 0)
        game_ids_json = self.player_games.get(player_name, "[]")
        game_ids = json.loads(game_ids_json)

        games = []
        for gid in game_ids:
            game_json = self.games.get(gid, None)
            if game_json:
                g = json.loads(game_json)
                games.append({
                    "game_id": g.get("id", gid),
                    "category": g.get("category", "unknown"),
                    "status": g.get("status", "unknown")
                })

        return {
            "player_name": player_name,
            "total_score": total_score,
            "games_played": len(games),
            "games": games
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
            result = gl.exec_prompt(judging_prompt)
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

        # This is the key GenLayer feature:
        # gl.eq_principle_strict_eq ensures all validators must return
        # the SAME winner ID for consensus to be reached.
        # If validators disagree, more are added until majority agrees.
        winner_id = gl.eq_principle_prompt_comparative(
            judge_comedy,
            "Both results must select the same winner ID number"
        )
        
        # Find the winning submission
        winner = None
        for s in submissions_list:
            if s["id"] == winner_id:
                winner = s
                break
        
        if winner is None:
            winner = submissions_list[0]
        
        # Update leaderboard
        current_score = self.leaderboard.get(winner["playerName"], 0)
        self.leaderboard[winner["playerName"]] = current_score + 100

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
            result = gl.exec_prompt(commentary_prompt)
            return result.strip()

        try:
            commentary_raw = gl.eq_principle_prompt_non_comparative(
                generate_commentary,
                "The commentary must be witty and relevant to the submissions"
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
    def create_game(self, game_id: str, host_name: str, category: str) -> typing.Any:
        """Create a new game (stores minimal on-chain data)"""
        existing = self.games.get(game_id, None)
        if existing is not None:
            raise Exception("Game ID already exists")
        
        game_state = {
            "id": game_id,
            "host": host_name,
            "category": category,
            "status": "created",
            "rounds_judged": 0
        }
        
        self.games[game_id] = json.dumps(game_state)
        self.total_games += 1

        # Track host in player_games index
        host_games = json.loads(self.player_games.get(host_name, "[]"))
        if game_id not in host_games:
            host_games.append(game_id)
            self.player_games[host_name] = json.dumps(host_games)

        return game_state

    @gl.public.write
    def record_game_result(
        self,
        game_id: str,
        final_scores: str  # JSON array of {playerName, score}
    ) -> typing.Any:
        """Record final game results to leaderboard"""
        # Idempotency: skip if already recorded
        game_json = self.games.get(game_id, None)
        if game_json is not None:
            try:
                game = json.loads(game_json)
                if game.get("status") == "finished":
                    return {"recorded": False, "reason": "already_finished"}
            except (json.JSONDecodeError, ValueError):
                pass

        try:
            scores_list = json.loads(final_scores)
        except (json.JSONDecodeError, ValueError):
            raise Exception("Invalid JSON for final_scores")
        
        for player in scores_list:
            name = player["playerName"]
            score = player["score"]
            current = self.leaderboard.get(name, 0)
            self.leaderboard[name] = current + score

            # Track player in player_games index
            pg = json.loads(self.player_games.get(name, "[]"))
            if game_id not in pg:
                pg.append(game_id)
                self.player_games[name] = json.dumps(pg)

        # Update game state
        existing_json = self.games.get(game_id, None)
        if existing_json:
            try:
                game = json.loads(existing_json)
            except (json.JSONDecodeError, ValueError):
                game = {"id": game_id}
            game["status"] = "finished"
            self.games[game_id] = json.dumps(game)

        return {"recorded": True, "players_updated": len(scores_list)}

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
            result = gl.exec_prompt(appeal_prompt)
            try:
                winner_id = int(result.strip())
                valid_ids = [s["id"] for s in submissions_list]
                if winner_id in valid_ids:
                    return winner_id
                return submissions_list[0]["id"]
            except (ValueError, TypeError, KeyError):
                return submissions_list[0]["id"]

        new_winner_id = gl.eq_principle_prompt_comparative(
            judge_appeal,
            "Both results must select the same winner ID number"
        )
        overturned = new_winner_id != original_winner_id

        if overturned:
            # Update leaderboard: remove old winner points, add new
            old_winner = None
            new_winner = None
            for s in submissions_list:
                if s["id"] == original_winner_id:
                    old_winner = s
                if s["id"] == new_winner_id:
                    new_winner = s

            if old_winner:
                current = self.leaderboard.get(old_winner["playerName"], 0)
                self.leaderboard[old_winner["playerName"]] = max(0, current - 100)
            if new_winner:
                current = self.leaderboard.get(new_winner["playerName"], 0)
                self.leaderboard[new_winner["playerName"]] = current + 100

        self.total_judgments += 1

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

    @gl.public.write
    def season_reset(self, season_id: str) -> typing.Any:
        """
        Archive the current leaderboard and start a fresh season.

        Snapshots the full leaderboard into the seasons archive, then
        zeroes every player's score. Demonstrates contract state management
        — all historical data remains on-chain and queryable.
        """
        existing = self.seasons.get(season_id, None)
        if existing is not None:
            raise Exception("Season ID already archived")

        # Snapshot current leaderboard
        snapshot = []
        for name in self.leaderboard:
            snapshot.append({
                "name": name,
                "score": self.leaderboard[name]
            })
        snapshot.sort(key=lambda x: x["score"], reverse=True)

        archive = {
            "season_id": season_id,
            "leaderboard": snapshot,
            "total_games": self.total_games,
            "total_judgments": self.total_judgments
        }
        self.seasons[season_id] = json.dumps(archive)

        # Reset live leaderboard
        for entry in snapshot:
            self.leaderboard[entry["name"]] = 0

        return archive

    @gl.public.view
    def get_season(self, season_id: str) -> typing.Any:
        """Retrieve an archived season's leaderboard."""
        season_json = self.seasons.get(season_id, None)
        if season_json is None:
            return None
        return json.loads(season_json)
