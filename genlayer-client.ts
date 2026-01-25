/**
 * Oracle of Wit - GenLayerJS Integration Example
 * ===============================================
 * 
 * This file shows how to interact with the Oracle of Wit contract
 * using the official GenLayerJS SDK.
 * 
 * Install: npm install genlayer-js
 */

import { createClient, createAccount } from 'genlayer-js';
import { simulator, testnet } from 'genlayer-js/chains';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Update this after deploying your contract
const CONTRACT_ADDRESS = '0x...';

// Choose your network
const NETWORK = simulator; // or testnet for production testing

// =============================================================================
// CLIENT SETUP
// =============================================================================

/**
 * Create a GenLayer client with an account
 */
export function createGameClient(privateKey?: string) {
  const account = privateKey 
    ? createAccount(privateKey)
    : createAccount();
  
  const client = createClient({
    chain: NETWORK,
    account,
  });
  
  return { client, account };
}

// =============================================================================
// CONTRACT INTERACTIONS
// =============================================================================

/**
 * Deposit XP tokens into the game contract
 */
export async function depositXP(
  client: ReturnType<typeof createClient>,
  amount: number
): Promise<string> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'deposit_xp',
    args: [],
    value: BigInt(amount),
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  return hash;
}

/**
 * Withdraw XP tokens from the game contract
 */
export async function withdrawXP(
  client: ReturnType<typeof createClient>,
  amount: number
): Promise<string> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'withdraw_xp',
    args: [amount],
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  return hash;
}

/**
 * Get a player's XP balance
 */
export async function getBalance(
  client: ReturnType<typeof createClient>,
  playerAddress: string
): Promise<number> {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_balance',
    args: [playerAddress],
  });
  
  return result as number;
}

/**
 * Create a new game room
 */
export async function createGame(
  client: ReturnType<typeof createClient>,
  options: {
    minPlayers?: number;
    maxPlayers?: number;
    betMin?: number;
    betMax?: number;
  } = {}
): Promise<string> {
  const { minPlayers = 2, maxPlayers = 10, betMin = 10, betMax = 100 } = options;
  
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'create_game',
    args: [minPlayers, maxPlayers, betMin, betMax],
  });
  
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  // Parse game_id from receipt/events
  // For now, return the expected ID based on counter
  return `GAME_1`; // In production, parse from receipt
}

/**
 * Join an existing game
 */
export async function joinGame(
  client: ReturnType<typeof createClient>,
  gameId: string
): Promise<void> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'join_game',
    args: [gameId],
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
}

/**
 * Start a game (host only)
 * This triggers AI joke prompt generation!
 */
export async function startGame(
  client: ReturnType<typeof createClient>,
  gameId: string
): Promise<string> {
  console.log('🚀 Starting game - AI will generate joke prompt...');
  
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'start_game',
    args: [gameId],
  });
  
  console.log('⏳ Waiting for AI consensus on joke prompt...');
  
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  // Get the generated prompt from game state
  const gameState = await getGameState(client, gameId);
  console.log('✅ Joke prompt generated:', gameState?.joke_prompt);
  
  return gameState?.joke_prompt || '';
}

/**
 * Submit a punchline
 */
export async function submitPunchline(
  client: ReturnType<typeof createClient>,
  gameId: string,
  punchline: string
): Promise<number> {
  if (punchline.length > 200) {
    throw new Error('Punchline must be 200 characters or less');
  }
  
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'submit_punchline',
    args: [gameId, punchline],
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  // Return anonymous ID (would parse from receipt in production)
  return 1;
}

/**
 * Start the betting phase
 */
export async function startBettingPhase(
  client: ReturnType<typeof createClient>,
  gameId: string
): Promise<void> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'start_betting_phase',
    args: [gameId],
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
}

/**
 * Place a bet on a submission
 */
export async function placeBet(
  client: ReturnType<typeof createClient>,
  gameId: string,
  submissionId: number,
  amount: number
): Promise<void> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'place_bet',
    args: [gameId, submissionId, amount],
  });
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
}

/**
 * Finalize judging - triggers AI ranking with consensus!
 */
export async function finalizeJudging(
  client: ReturnType<typeof createClient>,
  gameId: string
): Promise<{
  winningSubmissionId: number;
  winningAuthor: string;
  ranking: number[];
}> {
  console.log('🔮 Finalizing judging - AI will rank submissions...');
  
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'finalize_judging',
    args: [gameId],
  });
  
  console.log('⏳ Waiting for AI consensus on humor ranking...');
  console.log('🗳️ Validators are using Optimistic Democracy...');
  
  await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
  });
  
  // Get final results
  const gameState = await getGameState(client, gameId);
  
  console.log('✅ Judging complete!');
  console.log(`🏆 Winner: Submission #${gameState?.winning_submission_id}`);
  
  return {
    winningSubmissionId: gameState?.winning_submission_id || -1,
    winningAuthor: gameState?.winning_author || '',
    ranking: [], // Would parse from receipt
  };
}

/**
 * Get complete game state
 */
export async function getGameState(
  client: ReturnType<typeof createClient>,
  gameId: string
): Promise<GameState | null> {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_game_state',
    args: [gameId],
  });
  
  return result as GameState | null;
}

/**
 * Get player's leaderboard score
 */
export async function getPlayerScore(
  client: ReturnType<typeof createClient>,
  playerAddress: string
): Promise<PlayerScore | null> {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_player_score',
    args: [playerAddress],
  });
  
  return result as PlayerScore | null;
}

/**
 * Get contract info
 */
export async function getContractInfo(
  client: ReturnType<typeof createClient>
): Promise<ContractInfo> {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_contract_info',
    args: [],
  });
  
  return result as ContractInfo;
}

// =============================================================================
// TYPES
// =============================================================================

export interface GameState {
  game_id: string;
  host: string;
  status: 'waiting' | 'submitting' | 'betting' | 'judging' | 'finished';
  joke_prompt: string;
  players: string[];
  player_count: number;
  submission_count: number;
  submissions: Submission[];
  bet_count: number;
  prize_pool: number;
  bet_min: number;
  bet_max: number;
  winning_submission_id: number;
  winning_author: string;
}

export interface Submission {
  anonymous_id: number;
  text: string;
  author?: string;
}

export interface PlayerScore {
  address: string;
  total_xp: number;
  wins_as_author: number;
  correct_predictions: number;
  games_played: number;
}

export interface ContractInfo {
  owner: string;
  total_games: number;
  current_week: number;
  author_bonus_multiplier: number;
  predictor_share_percent: number;
  contract_balance: number;
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

async function exampleGameFlow() {
  console.log('🎭 Oracle of Wit - Example Game Flow\n');
  
  // Setup players
  const { client: aliceClient, account: alice } = createGameClient();
  const { client: bobClient, account: bob } = createGameClient();
  const { client: charlieClient, account: charlie } = createGameClient();
  
  console.log('👤 Alice:', alice.address);
  console.log('👤 Bob:', bob.address);
  console.log('👤 Charlie:', charlie.address);
  
  // Step 1: Deposit XP
  console.log('\n💰 Step 1: Depositing XP...');
  await depositXP(aliceClient, 1000);
  await depositXP(bobClient, 500);
  await depositXP(charlieClient, 500);
  
  // Step 2: Create game
  console.log('\n🎮 Step 2: Alice creates game...');
  const gameId = await createGame(aliceClient, {
    minPlayers: 2,
    maxPlayers: 10,
    betMin: 10,
    betMax: 100,
  });
  console.log('Game created:', gameId);
  
  // Step 3: Join game
  console.log('\n🚪 Step 3: Bob and Charlie join...');
  await joinGame(bobClient, gameId);
  await joinGame(charlieClient, gameId);
  
  // Step 4: Start game (AI generates prompt)
  console.log('\n🚀 Step 4: Alice starts game...');
  const jokePrompt = await startGame(aliceClient, gameId);
  console.log('AI Prompt:', jokePrompt);
  
  // Step 5: Submit punchlines
  console.log('\n✍️ Step 5: Everyone submits punchlines...');
  await submitPunchline(aliceClient, gameId, "That's fine, I'll just download a different bar.");
  await submitPunchline(bobClient, gameId, "I know. The philosopher is here to explain why you should.");
  await submitPunchline(charlieClient, gameId, "Error 418: I'm a teapot, not a customer.");
  
  // Step 6: Start betting
  console.log('\n🎯 Step 6: Start betting phase...');
  await startBettingPhase(aliceClient, gameId);
  
  // Step 7: Place bets
  console.log('\n💰 Step 7: Everyone places bets...');
  await placeBet(aliceClient, gameId, 2, 50); // Alice bets on #2
  await placeBet(bobClient, gameId, 1, 30);   // Bob bets on #1
  await placeBet(charlieClient, gameId, 2, 40); // Charlie bets on #2
  
  // Step 8: Finalize judging (AI consensus!)
  console.log('\n🔮 Step 8: Finalize judging...');
  const result = await finalizeJudging(aliceClient, gameId);
  
  // Step 9: Check results
  console.log('\n🏆 Results:');
  console.log('Winner ID:', result.winningSubmissionId);
  console.log('Winner Address:', result.winningAuthor);
  
  // Check balances
  console.log('\n💰 Final Balances:');
  console.log('Alice:', await getBalance(aliceClient, alice.address), 'XP');
  console.log('Bob:', await getBalance(bobClient, bob.address), 'XP');
  console.log('Charlie:', await getBalance(charlieClient, charlie.address), 'XP');
  
  // Check leaderboard
  console.log('\n📊 Leaderboard:');
  const aliceScore = await getPlayerScore(aliceClient, alice.address);
  console.log('Alice:', aliceScore);
}

// Run example if executed directly
if (require.main === module) {
  exampleGameFlow()
    .then(() => console.log('\n✅ Example complete!'))
    .catch(console.error);
}

export { exampleGameFlow };
