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
    """
    
    # Storage
    games: TreeMap[str, str]  # game_id -> game state JSON
    leaderboard: TreeMap[str, int]  # player_name -> total_score
    total_games: int
    total_judgments: int
    
    def __init__(self):
        """Initialize the Oracle of Wit contract"""
        self.total_games = 0
        self.total_judgments = 0
    
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
        
        submissions_list = json.loads(submissions)
        
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
            except:
                return submissions_list[0]["id"]
        
        # This is the key GenLayer feature:
        # gl.eq_principle_strict_eq ensures all validators must return
        # the SAME winner ID for consensus to be reached.
        # If validators disagree, more are added until majority agrees.
        winner_id = gl.eq_principle_strict_eq(judge_comedy)
        
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
        
        return {
            "winner_id": winner["id"],
            "winner_name": winner["playerName"],
            "winning_punchline": winner["punchline"],
            "consensus_method": "optimistic_democracy",
            "validators_agreed": True
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
        
        return game_state
    
    @gl.public.write  
    def record_game_result(
        self, 
        game_id: str, 
        final_scores: str  # JSON array of {playerName, score}
    ) -> typing.Any:
        """Record final game results to leaderboard"""
        scores_list = json.loads(final_scores)
        
        for player in scores_list:
            name = player["playerName"]
            score = player["score"]
            current = self.leaderboard.get(name, 0)
            self.leaderboard[name] = current + score
        
        # Update game state
        game_json = self.games.get(game_id, None)
        if game_json:
            game = json.loads(game_json)
            game["status"] = "finished"
            self.games[game_id] = json.dumps(game)
        
        return {"recorded": True, "players_updated": len(scores_list)}
