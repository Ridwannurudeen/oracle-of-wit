"""
Oracle of Wit - Test Script
============================

This script tests the Oracle of Wit contract in GenLayer Studio/Simulator.

To run these tests:
1. Start GenLayer Simulator: genlayer up
2. Open GenLayer Studio: http://localhost:8080
3. Deploy the contract manually or via CLI
4. Run this script: python test_oracle_of_wit.py

Alternatively, use GenLayer's test helpers in a proper test environment.
"""

import json
import time
import requests
from typing import Any, Dict, List, Optional, Tuple

# =============================================================================
# CONFIGURATION
# =============================================================================

SIMULATOR_URL = "http://localhost:4000/api"
CONTRACT_ADDRESS = ""  # Fill in after deployment

# Test accounts (will be created)
ACCOUNTS: Dict[str, Dict[str, str]] = {}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def rpc_call(method: str, params: List[Any] = []) -> Any:
    """Make an RPC call to the GenLayer node."""
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }
    response = requests.post(SIMULATOR_URL, json=payload)
    result = response.json()
    
    if "error" in result:
        raise Exception(f"RPC Error: {result['error']}")
    
    return result.get("result")


def create_account() -> Dict[str, str]:
    """Create a new test account."""
    result = rpc_call("sim_createAccount")
    return {
        "address": result["address"],
        "private_key": result["private_key"]
    }


def fund_account(address: str, amount: int = 10000):
    """Fund an account with test tokens."""
    rpc_call("sim_fundAccount", [address, amount])


def deploy_contract(deployer: Dict[str, str], code: str, args: List[Any] = []) -> str:
    """Deploy a contract and return its address."""
    result = rpc_call("gen_deployContract", [
        deployer["address"],
        code,
        json.dumps(args)
    ])
    
    # Wait for deployment
    tx_hash = result["hash"]
    wait_for_transaction(tx_hash)
    
    receipt = rpc_call("gen_getTransactionReceipt", [tx_hash])
    return receipt["contract_address"]


def call_contract(
    contract_address: str,
    method: str,
    args: List[Any] = [],
    caller: Optional[Dict[str, str]] = None,
    value: int = 0
) -> Any:
    """Call a contract method."""
    params = [
        contract_address,
        method,
        json.dumps(args)
    ]
    
    if caller:
        params.append(caller["address"])
    if value > 0:
        params.append(value)
    
    return rpc_call("gen_call", params)


def send_transaction(
    contract_address: str,
    method: str,
    args: List[Any],
    sender: Dict[str, str],
    value: int = 0
) -> str:
    """Send a transaction to a contract and wait for it to finalize."""
    result = rpc_call("gen_sendTransaction", [
        sender["address"],
        contract_address,
        method,
        json.dumps(args),
        value
    ])
    
    tx_hash = result["hash"]
    wait_for_transaction(tx_hash)
    
    return tx_hash


def wait_for_transaction(tx_hash: str, timeout: int = 120):
    """Wait for a transaction to be finalized."""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        receipt = rpc_call("gen_getTransactionReceipt", [tx_hash])
        
        if receipt and receipt.get("status") == "FINALIZED":
            return receipt
        
        time.sleep(2)
    
    raise TimeoutError(f"Transaction {tx_hash} not finalized within {timeout}s")


# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_setup():
    """Set up test environment."""
    global ACCOUNTS, CONTRACT_ADDRESS
    
    print("\n" + "="*60)
    print("🔧 SETTING UP TEST ENVIRONMENT")
    print("="*60)
    
    # Create test accounts
    print("\n📝 Creating test accounts...")
    
    for name in ["alice", "bob", "charlie", "dave"]:
        ACCOUNTS[name] = create_account()
        fund_account(ACCOUNTS[name]["address"], 10000)
        print(f"  ✅ {name}: {ACCOUNTS[name]['address'][:16]}...")
    
    # Deploy contract
    print("\n📦 Deploying Oracle of Wit contract...")
    
    with open("oracle_of_wit.py", "r") as f:
        contract_code = f.read()
    
    CONTRACT_ADDRESS = deploy_contract(ACCOUNTS["alice"], contract_code)
    print(f"  ✅ Contract deployed at: {CONTRACT_ADDRESS}")
    
    return True


def test_deposit_xp():
    """Test XP deposit functionality."""
    print("\n" + "="*60)
    print("💰 TEST: Deposit XP")
    print("="*60)
    
    # Alice deposits 1000 XP
    print("\n  Alice depositing 1000 XP...")
    send_transaction(
        CONTRACT_ADDRESS,
        "deposit_xp",
        [],
        ACCOUNTS["alice"],
        value=1000
    )
    
    # Check balance
    balance = call_contract(
        CONTRACT_ADDRESS,
        "get_balance",
        [ACCOUNTS["alice"]["address"]]
    )
    
    assert balance == 1000, f"Expected 1000, got {balance}"
    print(f"  ✅ Alice balance: {balance} XP")
    
    # Bob deposits 500 XP
    print("\n  Bob depositing 500 XP...")
    send_transaction(
        CONTRACT_ADDRESS,
        "deposit_xp",
        [],
        ACCOUNTS["bob"],
        value=500
    )
    
    balance = call_contract(
        CONTRACT_ADDRESS,
        "get_balance",
        [ACCOUNTS["bob"]["address"]]
    )
    
    assert balance == 500, f"Expected 500, got {balance}"
    print(f"  ✅ Bob balance: {balance} XP")
    
    # Charlie and Dave deposit
    for name in ["charlie", "dave"]:
        send_transaction(
            CONTRACT_ADDRESS,
            "deposit_xp",
            [],
            ACCOUNTS[name],
            value=500
        )
        print(f"  ✅ {name.capitalize()} deposited 500 XP")
    
    return True


def test_create_game():
    """Test game creation."""
    print("\n" + "="*60)
    print("🎮 TEST: Create Game")
    print("="*60)
    
    # Alice creates a game
    print("\n  Alice creating game...")
    send_transaction(
        CONTRACT_ADDRESS,
        "create_game",
        [2, 4, 10, 100],  # min_players, max_players, bet_min, bet_max
        ACCOUNTS["alice"]
    )
    
    # Check game state
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    print(f"  📊 Game state: {json.dumps(game_state, indent=4)}")
    
    assert game_state["game_id"] == "GAME_1", "Wrong game ID"
    assert game_state["status"] == "waiting", "Wrong status"
    assert game_state["host"] == ACCOUNTS["alice"]["address"], "Wrong host"
    assert game_state["player_count"] == 1, "Wrong player count"
    
    print("  ✅ Game created successfully!")
    
    return True


def test_join_game():
    """Test joining a game."""
    print("\n" + "="*60)
    print("🚪 TEST: Join Game")
    print("="*60)
    
    # Bob joins
    print("\n  Bob joining game...")
    send_transaction(
        CONTRACT_ADDRESS,
        "join_game",
        ["GAME_1"],
        ACCOUNTS["bob"]
    )
    
    # Charlie joins
    print("  Charlie joining game...")
    send_transaction(
        CONTRACT_ADDRESS,
        "join_game",
        ["GAME_1"],
        ACCOUNTS["charlie"]
    )
    
    # Check game state
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    assert game_state["player_count"] == 3, f"Expected 3 players, got {game_state['player_count']}"
    print(f"  ✅ {game_state['player_count']} players in game")
    print(f"  👥 Players: {game_state['players']}")
    
    return True


def test_start_game():
    """Test starting a game (AI generates joke prompt)."""
    print("\n" + "="*60)
    print("🚀 TEST: Start Game (AI Joke Generation)")
    print("="*60)
    
    print("\n  ⏳ Alice starting game (this triggers AI prompt generation)...")
    print("  📡 Validators will reach consensus via Optimistic Democracy...")
    
    send_transaction(
        CONTRACT_ADDRESS,
        "start_game",
        ["GAME_1"],
        ACCOUNTS["alice"]
    )
    
    # Check game state
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    assert game_state["status"] == "submitting", f"Expected 'submitting', got {game_state['status']}"
    assert len(game_state["joke_prompt"]) > 0, "No joke prompt generated"
    
    print(f"\n  ✅ Game started!")
    print(f"  🎭 AI-Generated Joke Prompt:")
    print(f"     \"{game_state['joke_prompt']}\"")
    
    return True


def test_submit_punchlines():
    """Test punchline submissions."""
    print("\n" + "="*60)
    print("✍️ TEST: Submit Punchlines")
    print("="*60)
    
    punchlines = {
        "alice": "...and that's when the cat said 'I've seen stranger things in my litter box.'",
        "bob": "The AI replied: 'At least I understand the assignment.'",
        "charlie": "The philosopher pondered: 'But what IS a bar, really?'"
    }
    
    for name, punchline in punchlines.items():
        print(f"\n  {name.capitalize()} submitting punchline...")
        send_transaction(
            CONTRACT_ADDRESS,
            "submit_punchline",
            ["GAME_1", punchline],
            ACCOUNTS[name]
        )
        print(f"  ✅ {name.capitalize()}: \"{punchline[:50]}...\"")
    
    # Check submissions
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    assert game_state["submission_count"] == 3, f"Expected 3 submissions, got {game_state['submission_count']}"
    print(f"\n  📊 Total submissions: {game_state['submission_count']}")
    
    return True


def test_betting_phase():
    """Test the betting phase."""
    print("\n" + "="*60)
    print("🎯 TEST: Betting Phase")
    print("="*60)
    
    # Start betting phase
    print("\n  Alice starting betting phase...")
    send_transaction(
        CONTRACT_ADDRESS,
        "start_betting_phase",
        ["GAME_1"],
        ACCOUNTS["alice"]
    )
    
    # Get anonymous submissions
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    assert game_state["status"] == "betting", f"Expected 'betting', got {game_state['status']}"
    
    print(f"\n  📋 Anonymous Submissions:")
    for sub in game_state["submissions"]:
        print(f"     #{sub['anonymous_id']}: \"{sub['text'][:40]}...\"")
    
    # Place bets
    bets = {
        "alice": (1, 50),   # Bet 50 XP on submission #1
        "bob": (2, 30),     # Bet 30 XP on submission #2
        "charlie": (1, 40)  # Bet 40 XP on submission #1
    }
    
    print(f"\n  💰 Placing bets...")
    for name, (sub_id, amount) in bets.items():
        send_transaction(
            CONTRACT_ADDRESS,
            "place_bet",
            ["GAME_1", sub_id, amount],
            ACCOUNTS[name]
        )
        print(f"  ✅ {name.capitalize()} bet {amount} XP on #{sub_id}")
    
    # Check prize pool
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    print(f"\n  🏆 Prize Pool: {game_state['prize_pool']} XP")
    print(f"  🎲 Total bets: {game_state['bet_count']}")
    
    return True


def test_finalize_judging():
    """Test AI judging and reward distribution."""
    print("\n" + "="*60)
    print("🔮 TEST: AI Judging & Rewards (Optimistic Democracy)")
    print("="*60)
    
    print("\n  ⏳ Finalizing judging (AI ranks submissions)...")
    print("  📡 Multiple validators will reach consensus on the ranking...")
    print("  🗳️ This is where Optimistic Democracy really shines!")
    
    # Get balances before
    balances_before = {}
    for name in ["alice", "bob", "charlie"]:
        balances_before[name] = call_contract(
            CONTRACT_ADDRESS,
            "get_balance",
            [ACCOUNTS[name]["address"]]
        )
    
    print(f"\n  💰 Balances BEFORE judging:")
    for name, balance in balances_before.items():
        print(f"     {name.capitalize()}: {balance} XP")
    
    # Finalize judging
    send_transaction(
        CONTRACT_ADDRESS,
        "finalize_judging",
        ["GAME_1"],
        ACCOUNTS["alice"]
    )
    
    # Get final game state
    game_state = call_contract(
        CONTRACT_ADDRESS,
        "get_game_state",
        ["GAME_1"]
    )
    
    assert game_state["status"] == "finished", f"Expected 'finished', got {game_state['status']}"
    
    print(f"\n  🏆 RESULTS:")
    print(f"     Winning Submission ID: #{game_state['winning_submission_id']}")
    print(f"     Winning Author: {game_state['winning_author'][:16]}...")
    
    # Find winner name
    winner_name = None
    for name, account in ACCOUNTS.items():
        if account["address"] == game_state["winning_author"]:
            winner_name = name
            break
    
    if winner_name:
        print(f"     🎉 Winner: {winner_name.upper()}!")
    
    # Get balances after
    print(f"\n  💰 Balances AFTER judging:")
    for name in ["alice", "bob", "charlie"]:
        balance_after = call_contract(
            CONTRACT_ADDRESS,
            "get_balance",
            [ACCOUNTS[name]["address"]]
        )
        diff = balance_after - balances_before[name]
        sign = "+" if diff >= 0 else ""
        print(f"     {name.capitalize()}: {balance_after} XP ({sign}{diff})")
    
    # Show all submissions with authors revealed
    print(f"\n  📋 Final Submissions (authors revealed):")
    for sub in game_state["submissions"]:
        is_winner = "🏆" if sub["anonymous_id"] == game_state["winning_submission_id"] else "  "
        author_name = "?"
        for name, account in ACCOUNTS.items():
            if account["address"] == sub.get("author", ""):
                author_name = name
                break
        print(f"     {is_winner} #{sub['anonymous_id']} by {author_name}: \"{sub['text'][:35]}...\"")
    
    return True


def test_leaderboard():
    """Test leaderboard functionality."""
    print("\n" + "="*60)
    print("📊 TEST: Leaderboard")
    print("="*60)
    
    print("\n  Player scores:")
    for name in ["alice", "bob", "charlie"]:
        score = call_contract(
            CONTRACT_ADDRESS,
            "get_player_score",
            [ACCOUNTS[name]["address"]]
        )
        print(f"\n  {name.capitalize()}:")
        print(f"     Total XP: {score['total_xp']}")
        print(f"     Wins as Author: {score['wins_as_author']}")
        print(f"     Correct Predictions: {score['correct_predictions']}")
        print(f"     Games Played: {score['games_played']}")
    
    return True


def test_contract_info():
    """Test contract info endpoint."""
    print("\n" + "="*60)
    print("ℹ️ TEST: Contract Info")
    print("="*60)
    
    info = call_contract(
        CONTRACT_ADDRESS,
        "get_contract_info",
        []
    )
    
    print(f"\n  📊 Contract Info:")
    print(f"     Owner: {info['owner'][:16]}...")
    print(f"     Total Games: {info['total_games']}")
    print(f"     Current Week: {info['current_week']}")
    print(f"     Author Bonus Multiplier: {info['author_bonus_multiplier']}%")
    print(f"     Predictor Share: {info['predictor_share_percent']}%")
    
    return True


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_all_tests():
    """Run all tests in sequence."""
    print("\n" + "="*60)
    print("🎭 ORACLE OF WIT - TEST SUITE")
    print("="*60)
    print("Testing GenLayer Intelligent Contract")
    print("="*60)
    
    tests = [
        ("Setup", test_setup),
        ("Deposit XP", test_deposit_xp),
        ("Create Game", test_create_game),
        ("Join Game", test_join_game),
        ("Start Game (AI Generation)", test_start_game),
        ("Submit Punchlines", test_submit_punchlines),
        ("Betting Phase", test_betting_phase),
        ("Finalize Judging (AI Consensus)", test_finalize_judging),
        ("Leaderboard", test_leaderboard),
        ("Contract Info", test_contract_info),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if result:
                passed += 1
                print(f"\n  ✅ {test_name}: PASSED")
            else:
                failed += 1
                print(f"\n  ❌ {test_name}: FAILED")
        except Exception as e:
            failed += 1
            print(f"\n  ❌ {test_name}: ERROR - {str(e)}")
    
    print("\n" + "="*60)
    print("📊 TEST RESULTS")
    print("="*60)
    print(f"  ✅ Passed: {passed}")
    print(f"  ❌ Failed: {failed}")
    print(f"  📈 Success Rate: {passed}/{passed+failed} ({100*passed/(passed+failed):.1f}%)")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    import sys
    
    # Check for contract address argument
    if len(sys.argv) > 1:
        CONTRACT_ADDRESS = sys.argv[1]
        print(f"Using contract address: {CONTRACT_ADDRESS}")
    
    success = run_all_tests()
    sys.exit(0 if success else 1)
