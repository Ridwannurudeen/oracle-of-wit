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

    def __init__(self):
        """Initialize the Oracle of Wit contract"""
        self.total_games = 0
        self.total_judgments = 0

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

        # gl.eq_principle_prompt_comparative ensures all validators must return
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
    def record_game_count(self) -> typing.Any:
        """Increment the total games counter"""
        self.total_games += 1
        return {"total_games": self.total_games}
