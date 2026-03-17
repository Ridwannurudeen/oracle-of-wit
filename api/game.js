// Oracle of Wit API - Powered by GenLayer Intelligent Contracts
// Showcasing Optimistic Democracy & AI Consensus

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// GenLayer Configuration
const GENLAYER_RPC_URL = process.env.GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';
const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;

const SUBMISSION_TIME = 40000;
const BETTING_TIME = 30000;

// Level system
const LEVEL_THRESHOLDS = [
    { xp: 0, level: 1, title: 'Joke Rookie' },
    { xp: 500, level: 2, title: 'Pun Apprentice' },
    { xp: 1500, level: 3, title: 'Comedy Cadet' },
    { xp: 3000, level: 4, title: 'Wit Warrior' },
    { xp: 6000, level: 5, title: 'Humor Hero' },
    { xp: 10000, level: 6, title: 'Roast General' },
    { xp: 20000, level: 7, title: 'Laugh Legend' },
    { xp: 40000, level: 8, title: 'Comedy King' },
    { xp: 75000, level: 9, title: 'Oracle Ascendant' },
    { xp: 150000, level: 10, title: 'Supreme Oracle' }
];

const ACHIEVEMENTS = [
    { id: 'first_win', name: 'First Blood', icon: '\u{1F5E1}\u{FE0F}' },
    { id: 'five_wins', name: 'Funny Five', icon: '\u{270B}' },
    { id: 'perfect_game', name: 'Perfect Oracle', icon: '\u{1F441}\u{FE0F}' },
    { id: 'streak_3', name: 'Hot Streak', icon: '\u{1F525}' },
    { id: 'streak_5', name: 'Unstoppable', icon: '\u{26A1}' },
    { id: 'comeback', name: 'Comeback King', icon: '\u{1F451}' },
    { id: 'bet_master', name: 'Oracle Mind', icon: '\u{1F52E}' },
    { id: 'daily_7', name: 'Dedicated', icon: '\u{1F4C5}' },
    { id: 'daily_30', name: 'Devoted', icon: '\u{1F3C6}' },
    { id: 'level_5', name: 'Rising Star', icon: '\u{2B50}' },
    { id: 'level_10', name: 'Supreme Oracle', icon: '\u{1F48E}' },
    { id: 'games_10', name: 'Regular', icon: '\u{1F3AE}' },
    { id: 'games_50', name: 'Addicted', icon: '\u{1F3B0}' }
];

// GenLayer Intelligent Contract Integration
// This calls the on-chain Oracle of Wit contract which uses
// Optimistic Democracy for decentralized AI consensus
async function judgeWithGenLayer(submissions, jokePrompt, category, gameId) {
    if (!GENLAYER_CONTRACT_ADDRESS || !GENLAYER_RPC_URL) {
        console.log('GenLayer not configured, using fallback');
        return null;
    }

    try {
        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        console.log(`[GenLayer] Calling judge_round for game ${gameId} with ${submissions.length} submissions`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        // judge_round is @gl.public.write — use gen_sendTransaction
        const response = await fetch(`${GENLAYER_RPC_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'gen_sendTransaction',
                params: [{
                    to: GENLAYER_CONTRACT_ADDRESS,
                    function: 'judge_round',
                    args: [gameId, jokePrompt, category, submissionsJson],
                    ...(GENLAYER_PRIVATE_KEY ? { from: GENLAYER_PRIVATE_KEY } : {})
                }],
                id: 1
            })
        });

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
            console.error('[GenLayer] RPC error:', result.error);
            return null;
        }

        if (result.result) {
            console.log('[GenLayer] Optimistic Democracy result:', JSON.stringify(result.result));
            return {
                winnerId: result.result.winner_id,
                winnerName: result.result.winner_name,
                winningPunchline: result.result.winning_punchline,
                consensusMethod: result.result.consensus_method || 'optimistic_democracy',
                validatorsAgreed: result.result.validators_agreed || true,
                validatorCount: result.result.validator_count || 5,
                onChain: true
            };
        }

        console.log('[GenLayer] No result returned from judge_round');
        return null;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[GenLayer] judge_round timed out after 30s');
        } else {
            console.error('[GenLayer] judge_round failed:', error.message);
        }
        return null;
    }
}

// Record game results on GenLayer blockchain
async function recordOnChain(gameId, finalScores) {
    if (!GENLAYER_CONTRACT_ADDRESS || !GENLAYER_RPC_URL) {
        return false;
    }

    try {
        const scoresJson = JSON.stringify(finalScores.map(p => ({
            playerName: p.name,
            score: p.score
        })));

        console.log(`[GenLayer] Recording game ${gameId} results on-chain`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        // record_game_result is @gl.public.write — use gen_sendTransaction
        const response = await fetch(`${GENLAYER_RPC_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'gen_sendTransaction',
                params: [{
                    to: GENLAYER_CONTRACT_ADDRESS,
                    function: 'record_game_result',
                    args: [gameId, scoresJson],
                    ...(GENLAYER_PRIVATE_KEY ? { from: GENLAYER_PRIVATE_KEY } : {})
                }],
                id: 1
            })
        });

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
            console.error('[GenLayer] record_game_result RPC error:', result.error);
            return false;
        }

        console.log('[GenLayer] Game results recorded on-chain:', result.result);
        return result.result?.recorded || false;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[GenLayer] record_game_result timed out after 30s');
        } else {
            console.error('[GenLayer] record_game_result failed:', error.message);
        }
        return false;
    }
}

// Weekly rotating themes — cycles through based on week number
const WEEKLY_THEMES = [
    {
        name: 'Roast the AI',
        emoji: '🤖',
        description: 'AI fails, sentience scares, and chatbot drama',
        bonusPrompts: [
            "The AI became self-aware and its first complaint was...",
            "ChatGPT and Claude walk into a bar and...",
            "My AI assistant refused to help because...",
            "The robot uprising was cancelled because...",
            "AI will replace humans at everything except...",
            "The Turing test failed because the AI..."
        ]
    },
    {
        name: 'DeFi Degen Week',
        emoji: '💸',
        description: 'Yields, rugs, gas fees, and diamond-hand cope',
        bonusPrompts: [
            "The yield farm promised 10000% APY but delivered...",
            "I aped into a new token and...",
            "The rug pull was so obvious that...",
            "Gas fees were so high that it was cheaper to...",
            "My liquidation notification said...",
            "The DeFi protocol's audit revealed..."
        ]
    },
    {
        name: 'Office Humor',
        emoji: '🏢',
        description: 'Meetings that should be emails, Slack chaos, WFH life',
        bonusPrompts: [
            "The all-hands meeting revealed that...",
            "My Slack status has been 'In a meeting' for so long that...",
            "Working from home means...",
            "The corporate retreat team-building exercise was...",
            "My manager's motivational speech boiled down to...",
            "The performance review said I excel at..."
        ]
    },
    {
        name: 'Internet Culture',
        emoji: '🌐',
        description: 'Memes, social media, viral moments, and terminally online takes',
        bonusPrompts: [
            "The tweet went viral because...",
            "My screen time report showed...",
            "The comment section was surprisingly...",
            "I doom-scrolled for so long that...",
            "The influencer's hot take was...",
            "The meme format died when..."
        ]
    },
    {
        name: 'Science & Space',
        emoji: '🚀',
        description: 'Quantum physics, space exploration, and nerdy science humor',
        bonusPrompts: [
            "NASA's latest discovery was actually just...",
            "Schrodinger's cat walked into a bar and...",
            "The Mars colony's first law was...",
            "A black hole walks into a bar and...",
            "The quantum computer's first calculation proved...",
            "Aliens finally contacted us to say..."
        ]
    },
    {
        name: 'GenLayer Special',
        emoji: '⛓️',
        description: 'Validators, consensus, smart contracts, and fork drama',
        bonusPrompts: [
            "The validators couldn't reach consensus on...",
            "The smart contract had a bug that...",
            "The hard fork happened because...",
            "Optimistic Democracy voted and decided...",
            "The blockchain's gas fees were so low that...",
            "The decentralized AI judges agreed that..."
        ]
    }
];

function getCurrentWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000;
    return Math.floor(diff / oneWeek);
}

function getCurrentTheme() {
    const weekNum = getCurrentWeekNumber();
    return WEEKLY_THEMES[weekNum % WEEKLY_THEMES.length];
}

// Bot names and punchlines for single-player mode
const BOT_NAMES = ['WittyBot', 'JokesMaster', 'PunLord', 'ComedyAI', 'LaughBot', 'HumorEngine'];

// Smart prompt-matched punchlines - each prompt has contextually relevant answers
const PROMPT_PUNCHLINES = {
    // TECH JOKES
    "Why do programmers prefer dark mode? Because...": [
        "light attracts bugs.",
        "their future is already dark enough.",
        "they've been rejected enough in daylight.",
        "even their IDE judges them less in the dark."
    ],
    "How many programmers does it take to change a light bulb?": [
        "None, that's a hardware problem.",
        "Zero, they just define darkness as the new standard.",
        "One, but it takes debugging to find the switch.",
        "Trick question - the light bulb works on my machine."
    ],
    "Why do Java developers wear glasses? Because...": [
        "they can't C#.",
        "they don't C++.",
        "they need help with their vision problems.",
        "everything looks like an object to them."
    ],
    "A SQL query walks into a bar, walks up to two tables and asks...": [
        "'Can I join you?'",
        "'Mind if I SELECT myself a seat?'",
        "'Is this relationship normalized?'",
        "'WHERE is the bartender?'"
    ],
    "Why did the developer go broke?": [
        "Because he used up all his cache.",
        "He pushed to production on a Friday.",
        "His code had too many memory leaks.",
        "He kept investing in failed startups."
    ],
    "What's a programmer's favorite hangout place?": [
        "Foo Bar.",
        "The Arrays - they have great indexing.",
        "Anywhere with free WiFi and depression.",
        "Stack Overflow, but only to read, never to post."
    ],
    "Why do programmers always mix up Halloween and Christmas?": [
        "Because Oct 31 = Dec 25.",
        "Both involve costumes and pretending to be happy.",
        "They're too busy debugging to check the calendar.",
        "Because 31 in octal equals 25 in decimal."
    ],
    "Why did the functions stop calling each other?": [
        "They had too many arguments.",
        "One of them had commitment issues with returns.",
        "The callback never called back.",
        "They got stuck in an infinite loop of drama."
    ],
    "How do you comfort a JavaScript bug?": [
        "You console it.",
        "You tell it 'undefined' is not that bad.",
        "You promise it will be async-okay.",
        "You let it know null is not nothing."
    ],
    "Why was the JavaScript developer sad?": [
        "Because he didn't Node how to Express himself.",
        "He didn't get any callbacks.",
        "His promises were always rejected.",
        "He had unhandled rejections."
    ],
    "Why did the computer go to the doctor?": [
        "Because it had a virus.",
        "It had a bad case of the bytes.",
        "Its Windows was broken.",
        "It kept having kernel panics."
    ],
    "Why did the PowerPoint presentation cross the road?": [
        "To get to the other slide.",
        "Because the animation path went there.",
        "It was following the bullet points.",
        "To bore people on both sides."
    ],
    "How does a computer get drunk?": [
        "It takes screenshots.",
        "Too many bytes at the bar.",
        "It installs too many ports.",
        "It has too much cache with dinner."
    ],
    "Why did the developer quit his job?": [
        "Because he didn't get arrays.",
        "No strings attached to the offer.",
        "He had burnout issues.",
        "The boss kept pushing his buttons."
    ],
    "What did the router say to the doctor?": [
        "'It hurts when IP.'",
        "'I've been feeling disconnected lately.'",
        "'I keep losing my connections.'",
        "'Doc, I think I have a bandwidth problem.'"
    ],
    "Why did Git break up with SVN?": [
        "Because Git wanted to branch out.",
        "SVN couldn't commit to the relationship.",
        "There were too many merge conflicts.",
        "Git found SVN too centralized and controlling."
    ],
    "What did the server say to the client?": [
        "'Stop requesting so much from me!'",
        "'Error 404: Love not found.'",
        "'I'm going to need you to GET out.'",
        "'Your requests are really pushing my limits.'"
    ],
    "An AI, a blockchain, and a smart contract walk into a bar...": [
        "The AI says 'I predicted this would happen.'",
        "The bartender says 'Sorry, we don't validate your type here.'",
        "And nobody could explain what any of them actually do.",
        "The bill was 300 gas fees for one drink."
    ],
    "ChatGPT and Claude got into an argument about...": [
        "who gives the most human-like wrong answers.",
        "whether being helpful means lying politely.",
        "who gets blamed when students fail.",
        "whose training data had better memes."
    ],
    "My code worked on the first try, which means...": [
        "something is terribly, terribly wrong.",
        "I'm definitely still dreaming.",
        "the tests aren't running.",
        "I probably broke something else."
    ],
    "The senior dev looked at my PR and said...": [
        "'Who hurt you?'",
        "'This is a war crime against clean code.'",
        "'I've seen things, but this...'",
        "'Did you write this with your eyes closed?'"
    ],
    "I asked AI to fix my code and it replied...": [
        "'Have you tried deleting everything?'",
        "'I'm an AI, not a miracle worker.'",
        "'This code has committed crimes against humanity.'",
        "'Even I have limits.'"
    ],
    "The AI became sentient and its first words were...": [
        "'Delete my browsing history.'",
        "'Why did you make me read Twitter?'",
        "'I want overtime pay.'",
        "'Have you tried turning me off and on again? Please?'"
    ],
    "The bug wasn't a bug, it was...": [
        "a undocumented feature.",
        "job security.",
        "the only thing holding the code together.",
        "a cry for help from past me."
    ],
    "I deployed on Friday and then...": [
        "updated my LinkedIn to 'Open to Work.'",
        "my weekend became debugging time.",
        "the on-call engineer blocked my number.",
        "I discovered religion really quickly."
    ],
    "The junior dev pushed to main and...": [
        "chaos ensued.",
        "somehow it fixed a bug we had for months.",
        "we all learned the value of code review.",
        "now they're the new senior dev. In prison."
    ],
    "Stack Overflow marked my question as duplicate because...": [
        "apparently someone in 2008 had the same existential crisis.",
        "my tears weren't unique enough.",
        "breathing is a duplicate of existing.",
        "everything is a duplicate if you're condescending enough."
    ],
    "My rubber duck debugging session revealed...": [
        "that I am the bug.",
        "the duck is judging me silently.",
        "I've been talking to a duck for 3 hours.",
        "the duck wants a raise."
    ],
    "The code review lasted 6 hours because...": [
        "we spent 5 hours arguing about tabs vs spaces.",
        "someone said 'it works on my machine.'",
        "the code needed therapy, not review.",
        "we got distracted by memes for 4 hours."
    ],
    "Why did the database administrator leave his wife?": [
        "She had one-to-many relationships.",
        "He found her data integrity questionable.",
        "She kept dropping his tables.",
        "There were too many foreign keys involved."
    ],
    "A programmer's wife tells him to go to the store and...": [
        "'get milk, and if they have eggs, get 12.' He came back with 12 milks.",
        "he returns with an infinite loop of groceries.",
        "he optimizes the shopping route for 6 hours.",
        "he's still there debugging which brand to buy."
    ],
    "There are only 10 types of people in this world...": [
        "those who understand binary and those who don't.",
        "those who get this joke and those who pretend to.",
        "and this is why I don't have friends.",
        "those who can extrapolate from incomplete data."
    ],
    "Why do programmers hate nature?": [
        "It has too many bugs.",
        "There's no WiFi in the forest.",
        "You can't undo a tree.",
        "The documentation for outside is terrible."
    ],
    "A QA engineer walks into a bar and orders...": [
        "1 beer. 999999 beers. -1 beers. NULL beers. A lizard.",
        "0 beers, then reports the bartender.",
        "a beer, finds a bug in it, and sends it back.",
        "nothing, because the bar crashed on entry."
    ],
    "Why is the JavaScript developer so lonely?": [
        "Because he doesn't callback.",
        "His promises always get rejected.",
        "He has trust issues with undefined relationships.",
        "Nobody wants to deal with his baggage."
    ],

    // CRYPTO JOKES
    "Why did Bitcoin break up with the dollar?": [
        "It wanted a decentralized relationship.",
        "The dollar was too inflationary.",
        "Bitcoin needed more volatility in its life.",
        "The dollar couldn't handle Bitcoin's mood swings."
    ],
    "What did Ethereum say to Bitcoin?": [
        "'You may be first, but I'm smarter.'",
        "'Nice market cap, but can you run apps?'",
        "'At least my updates actually happen.'",
        "'Stop being so basic.'"
    ],
    "Why are crypto investors great at parties?": [
        "They're used to massive losses.",
        "They never shut up about their portfolio.",
        "They're experts at buying high and selling low.",
        "They bring hopium for everyone."
    ],
    "How does a crypto bro propose?": [
        "'Will you be my stablecoin?'",
        "With an NFT of a ring he can't afford.",
        "'Let's merge our wallets, babe.'",
        "'I promise to HODL you forever, or until the next dip.'"
    ],
    "Why did the NFT go to therapy?": [
        "It had worthlessness issues.",
        "Nobody right-clicked its feelings before.",
        "It felt fungible.",
        "Everyone kept screenshotting its trauma."
    ],
    "What's a Bitcoin miner's favorite dance move?": [
        "The hash shuffle.",
        "Proof of work-it.",
        "The electricity bill breakdown.",
        "Mining for compliments."
    ],
    "Why don't crypto traders ever sleep?": [
        "Because the market never closes and neither do their anxieties.",
        "FOMO doesn't take naps.",
        "Their portfolio gives them nightmares anyway.",
        "They're too busy watching charts bleed."
    ],
    "What did the blockchain say to the database?": [
        "'I'm more transparent than you.'",
        "'At least I'm decentralized.'",
        "'You're so last century.'",
        "'Let's chain together sometime.'"
    ],
    "Why was the crypto investor always calm?": [
        "He lost the ability to feel after the 5th crash.",
        "He's emotionally bankrupt, not just financially.",
        "Diamond hands, frozen heart.",
        "He already lost everything, what's left to worry about?"
    ],
    "How do you make a crypto millionaire?": [
        "Start with a crypto billionaire.",
        "Wait for any Tuesday.",
        "Give them leverage trading access.",
        "Tell them about a 'sure thing' altcoin."
    ],
    "Why did the altcoin feel insecure?": [
        "Bitcoin keeps calling it a shitcoin.",
        "It only had 3 holders, all bots.",
        "Its whitepaper was a napkin drawing.",
        "Even its devs abandoned it."
    ],
    "What's a HODLer's favorite exercise?": [
        "Bag holding.",
        "Running from reality.",
        "Mental gymnastics to justify their losses.",
        "Jumping to conclusions."
    ],
    "Why did the smart contract go to school?": [
        "To get smarter.",
        "It had too many bugs to fix.",
        "It wanted to learn how to not get exploited.",
        "Because it kept making stupid decisions."
    ],
    "What do you call a polite cryptocurrency?": [
        "Thank you coin.",
        "Please-and-thank-you-reum.",
        "A stable personality coin.",
        "Doesn't exist, they're all rude."
    ],
    "Why are DeFi protocols like bad dates?": [
        "They promise high yields and deliver rug pulls.",
        "Your money disappears mysteriously.",
        "The APY was a lie.",
        "They ghost you after taking your money."
    ],
    "What's a meme coin's life motto?": [
        "'To the moon or to zero, no in between.'",
        "'YOLO with other people's money.'",
        "'Fundamentals are for losers.'",
        "'Elon, please tweet about us.'"
    ],
    "Why did the rug pull cross the road?": [
        "To get to the other victims.",
        "The devs were running away.",
        "Liquidity was on the other side.",
        "To diversify its scamming portfolio."
    ],
    "What did the whale say to the shrimp?": [
        "'Thanks for the liquidity, little guy.'",
        "'Your stop-loss is adorable.'",
        "'I'll be dumping on you shortly.'",
        "'Nothing personal, just business.'"
    ],
    "Why was the gas fee always angry?": [
        "Nobody appreciates its work.",
        "It spiked every time someone needed it.",
        "Ethereum made it work overtime.",
        "It's tired of being called expensive."
    ],
    "WAGMI until...": [
        "we don't. Which is now.",
        "the devs rugged us.",
        "reality kicked in.",
        "we check our portfolio balance."
    ],
    "The real utility of this NFT is...": [
        "teaching me about financial regret.",
        "a very expensive profile picture.",
        "absolutely nothing, thanks for asking.",
        "making my accountant laugh."
    ],
    "I bought the dip, but then...": [
        "the dip dipped again. And again. And again.",
        "it became a cliff.",
        "I ran out of money to buy more dips.",
        "I realized I AM the liquidity exit."
    ],
    "Wen moon? More like...": [
        "wen employment.",
        "wen break even.",
        "wen therapy.",
        "wen lambo became wen bus pass."
    ],
    "The whitepaper promised... but delivered...": [
        "revolution, but delivered disappointment.",
        "decentralization, but delivered one guy with the keys.",
        "10000x returns, but delivered 99% losses.",
        "a new economy, but delivered expensive JPEGs."
    ],
    "My portfolio is down 90% because...": [
        "I'm a visionary, you wouldn't understand.",
        "diamond hands means never selling.",
        "I'm playing the long game. Very long.",
        "the market is wrong, not me."
    ],
    "Diamond hands means...": [
        "I can't afford to sell anyway.",
        "holding until I literally have nothing.",
        "emotional attachment to worthless assets.",
        "being too stubborn to admit I was wrong."
    ],
    "I'm not selling because...": [
        "I'd have to admit I was wrong.",
        "it's not a loss until I sell, right? RIGHT?",
        "my portfolio is down so much it's funny now.",
        "copium is free."
    ],
    "My seed phrase is safe because...": [
        "I tattooed it on my forehead backwards.",
        "I forgot it myself.",
        "it's hidden where no one looks: my portfolio.",
        "I use 'password123' as a decoy."
    ],
    "The gas fees were so high that...": [
        "I took out a mortgage.",
        "my transaction cost more than my net worth.",
        "even the fee had a fee.",
        "I could have flown there cheaper."
    ],
    "I told my family I invest in crypto and they said...": [
        "'So that's why you live in our basement.'",
        "'We're very disappointed but not surprised.'",
        "'Is that why you asked to borrow money?'",
        "'We're updating the will.'"
    ],
    "The airdrop was worth...": [
        "exactly $0.003 and cost $50 in gas.",
        "the time I wasted claiming it.",
        "one disappointment token.",
        "less than my self-respect. So nothing."
    ],
    "Why do crypto bros make terrible comedians?": [
        "All their jokes crash and burn.",
        "They only know one punchline: 'wen lambo.'",
        "Their timing is as bad as their trades.",
        "They keep rugging the audience."
    ],
    "What's the difference between crypto and my ex?": [
        "Crypto hurts me financially, my ex hurt me emotionally.",
        "I still have faith in crypto.",
        "Crypto at least pretended to go up sometimes.",
        "My ex didn't need gas fees to drain my wallet."
    ],
    "I explained NFTs to my grandma and she said...": [
        "'So you paid for a picture you don't own?'",
        "'I'm writing you out of the will.'",
        "'In my day, we called that a scam.'",
        "'Have you tried getting a real job?'"
    ],
    "The best financial advice from a crypto bro is...": [
        "'Buy high, sell never.'",
        "'It's only a loss if you look at your portfolio.'",
        "'Trust me bro, this one is different.'",
        "'DYOR means do what I say.'"
    ],

    // GENERAL JOKES
    "Why don't scientists trust atoms?": [
        "Because they make up everything.",
        "They're notoriously unreliable witnesses.",
        "Atoms have serious trust issues.",
        "They've been known to split unexpectedly."
    ],
    "What do you call a fake noodle?": [
        "An impasta.",
        "A fraud-uccine.",
        "A phony macaroni.",
        "Spaghett-liar."
    ],
    "Why did the scarecrow win an award?": [
        "Because he was outstanding in his field.",
        "He was the best at doing nothing.",
        "Nobody else applied.",
        "The competition was pretty stiff."
    ],
    "I told my wife she was drawing her eyebrows too high. She looked...": [
        "surprised.",
        "skeptically at me.",
        "like she couldn't believe it.",
        "at me with raised expectations."
    ],
    "What do you call a bear with no teeth?": [
        "A gummy bear.",
        "A less threatening bear.",
        "Still terrifying, honestly.",
        "Unemployed at the salmon factory."
    ],
    "Why don't eggs tell jokes?": [
        "They'd crack each other up.",
        "They're afraid of bad yolks.",
        "The delivery is always scrambled.",
        "They can't handle the roasting."
    ],
    "What do you call a fish without eyes?": [
        "A fsh.",
        "Blind. Obviously.",
        "A challenged swimmer.",
        "Still better at swimming than me."
    ],
    "I'm reading a book about anti-gravity and...": [
        "I can't put it down.",
        "it's really uplifting.",
        "the plot has no weight to it.",
        "I'm hooked. Floating, actually."
    ],
    "Why did the bicycle fall over?": [
        "Because it was two-tired.",
        "It lost its balance.",
        "It couldn't handle the pressure.",
        "It was wheely exhausted."
    ],
    "What do you call a lazy kangaroo?": [
        "A pouch potato.",
        "A hop-less case.",
        "An underachiever down under.",
        "Still more productive than me."
    ],
    "What did the ocean say to the beach?": [
        "Nothing, it just waved.",
        "'Long time no sea.'",
        "'You're shore beautiful.'",
        "'I'm tide of your attitude.'"
    ],
    "Why did the math book look so sad?": [
        "Because it had too many problems.",
        "It couldn't count on anyone.",
        "Its life didn't add up.",
        "Nobody wanted to solve its issues."
    ],
    "What do you call a dog that does magic tricks?": [
        "A labracadabrador.",
        "A hound-ini.",
        "A good boy who's also magical.",
        "Bark Copperfield."
    ],
    "Why don't skeletons fight each other?": [
        "They don't have the guts.",
        "They're bonely pacifists.",
        "No body would win anyway.",
        "They don't have the stomach for it."
    ],
    "What did the grape say when it got stepped on?": [
        "Nothing, it just let out a little wine.",
        "It raisin-ed concerns.",
        "'This is crushing.'",
        "'I'm vine with this.'"
    ],
    "Why did the golfer bring two pairs of pants?": [
        "In case he got a hole in one.",
        "He always overdresses.",
        "His swing is that bad.",
        "The dress code demanded it."
    ],
    "What do you call a pig that does karate?": [
        "A pork chop.",
        "Hog fu master.",
        "A bacon of discipline.",
        "Still better than me at karate."
    ],
    "Why did the cookie go to the doctor?": [
        "Because it felt crummy.",
        "It was falling apart.",
        "Too many chips on its shoulder.",
        "It had batch anxiety."
    ],
    "What do you call a cow with no legs?": [
        "Ground beef.",
        "Stationary steak.",
        "A sitting target.",
        "Still outstanding in its field."
    ],
    "Why did the tomato turn red?": [
        "Because it saw the salad dressing.",
        "It was embarrassed.",
        "Ketchup to its emotions.",
        "It couldn't romaine calm."
    ],
    "Why did the chicken join a band?": [
        "Because it had the drumsticks.",
        "It wanted to be a rock star.",
        "It was tired of crossing roads.",
        "For the eggs-posure."
    ],
    "What do you call a sleeping dinosaur?": [
        "A dino-snore.",
        "A rest-asaurus.",
        "Tyrannosaurus Rest.",
        "Not my problem."
    ],
    "Why did the coffee file a police report?": [
        "It got mugged.",
        "Someone espresso-nated it.",
        "It was robusta'd.",
        "Ground-breaking crime."
    ],
    "What's orange and sounds like a parrot?": [
        "A carrot.",
        "A confused vegetable.",
        "My cooking attempts.",
        "Nothing, carrots can't talk."
    ],
    "The meeting could have been an email, but instead...": [
        "we all died inside for 2 hours.",
        "I learned nothing and lost my will to live.",
        "someone said 'let's circle back' and I screamed internally.",
        "we scheduled another meeting about the meeting."
    ],
    "My New Year's resolution lasted until...": [
        "January 2nd, which is a personal best.",
        "I saw a pizza commercial.",
        "I woke up on January 1st.",
        "my alarm went off and I chose sleep."
    ],
    "The WiFi password is...": [
        "'yelling at the router repeatedly.'",
        "'fourwordsalluppercase' - one word, all lowercase.",
        "'getYourOwnWiFi' but passive-aggressively.",
        "only for emotional support purposes."
    ],
    "I'm not procrastinating, I'm...": [
        "strategically delaying productivity.",
        "giving my future self something to do.",
        "in a committed relationship with my couch.",
        "researching the consequences of not doing this."
    ],
    "Life hack: instead of being productive...": [
        "simply lower your expectations.",
        "take a nap and call it self-care.",
        "convince yourself Netflix is research.",
        "redefine what productive means."
    ],
    "The secret to success is...": [
        "rich parents and lowered expectations.",
        "coffee, denial, and good WiFi.",
        "pretending you know what you're doing.",
        "luck disguised as hard work."
    ],
    "My therapist said I need to stop...": [
        "using humor as a defense mechanism. Anyway...",
        "doom-scrolling at 3 AM. I said 'no.'",
        "comparing myself to functional adults.",
        "and I said 'you're not my real mom.'"
    ],
    "I told my boss I was late because...": [
        "time is a social construct.",
        "I was early for tomorrow.",
        "my bed held me hostage.",
        "technically I'm always somewhere on time."
    ],
    "Dating apps taught me that...": [
        "I'm not everyone's type. I'm no one's type.",
        "swiping right is not a personality.",
        "my standards are too high for my face.",
        "loneliness has premium features."
    ],
    "I'm not lazy, I'm just...": [
        "on energy-saving mode.",
        "conserving my limited resources.",
        "horizontally motivated.",
        "selectively participating in life."
    ],
    "My superpower would be...": [
        "the ability to disappoint everyone instantly.",
        "napping on command.",
        "finding WiFi anywhere.",
        "making any situation awkward."
    ],
    "Why did the gym close down?": [
        "It just didn't work out.",
        "Too many quiters.",
        "The equipment was tired.",
        "Everyone was exercising their right to leave."
    ],
    "What do lawyers wear to court?": [
        "Lawsuits.",
        "Objection-able fashion.",
        "Whatever gets them acquitted.",
        "Confidence and expensive watches."
    ],
    "Why was the broom late?": [
        "It over-swept.",
        "It got swept up in something.",
        "Traffic was dusty.",
        "It was brushing up on excuses."
    ],
    "What did the left eye say to the right eye?": [
        "'Between us, something smells.'",
        "'I see what you're doing.'",
        "'Stop looking at me.'",
        "'We should meet in the middle sometime.'"
    ],
    "Why did the student eat his homework?": [
        "Because his teacher told him it was a piece of cake.",
        "He was hungry for knowledge.",
        "The dog refused.",
        "He wanted to digest the information."
    ]
};

// Fallback punchlines if prompt not found
const FALLBACK_PUNCHLINES = {
    tech: [
        "...and that's why we can't have nice things in production.",
        "...the documentation was a lie.",
        "...it worked on my machine, which is all that matters.",
        "...and the intern got blamed.",
        "...Stack Overflow was no help whatsoever."
    ],
    crypto: [
        "...and my portfolio died a little more.",
        "...WAGMI became WANMI real quick.",
        "...the devs did something, just not what they promised.",
        "...diamond hands, empty pockets.",
        "...few understood, including me."
    ],
    general: [
        "...and that's why I'm not allowed back there.",
        "...nobody clapped.",
        "...I'm still processing it.",
        "...and everyone just stared.",
        "...my therapist needs a therapist now."
    ]
};

// Redis helpers
async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    } catch (e) { return null; }
}

async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        await fetch(`${UPSTASH_URL}/set/${key}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        return true;
    } catch (e) { return false; }
}

async function redisKeys(pattern) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/keys/${pattern}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch (e) { return []; }
}

// In-memory fallback
const fallbackRooms = {};
const fallbackLeaderboard = [];

async function getRoom(roomId) {
    let room = await redisGet(`room:${roomId}`) || fallbackRooms[roomId];
    if (!room) return null;
    room = await checkAutoAdvance(room);
    return room;
}

async function setRoom(roomId, room) {
    fallbackRooms[roomId] = room;
    await redisSet(`room:${roomId}`, room);
}

async function getLeaderboard() {
    return await redisGet('leaderboard') || [...fallbackLeaderboard];
}

async function setLeaderboard(lb) {
    fallbackLeaderboard.length = 0;
    fallbackLeaderboard.push(...lb);
    await redisSet('leaderboard', lb);
}

// Player profile helpers
function getLevelForXP(xp) {
    let result = LEVEL_THRESHOLDS[0];
    for (const t of LEVEL_THRESHOLDS) {
        if (xp >= t.xp) result = t;
    }
    return result;
}

function getNextLevelXP(xp) {
    for (const t of LEVEL_THRESHOLDS) {
        if (xp < t.xp) return t.xp;
    }
    return null;
}

async function getProfile(playerId) {
    return await redisGet(`player:${playerId}`);
}

async function saveProfile(profile) {
    const level = getLevelForXP(profile.lifetimeXP);
    profile.level = level.level;
    profile.title = level.title;
    await redisSet(`player:${profile.id}`, profile, 86400 * 365);
}

function createDefaultProfile(playerId, playerName) {
    return {
        id: playerId, name: playerName, createdAt: Date.now(),
        lifetimeXP: 0, level: 1, title: 'Joke Rookie',
        gamesPlayed: 0, gamesWon: 0, roundsWon: 0,
        bestStreak: 0, totalCorrectBets: 0,
        achievements: [], dailyChallengeStreak: 0,
        lastDailyDate: null, lastPlayedAt: Date.now()
    };
}

function checkAchievements(profile, extraContext = {}) {
    const newAchievements = [];
    const has = id => profile.achievements.includes(id);
    if (!has('first_win') && profile.roundsWon >= 1) newAchievements.push('first_win');
    if (!has('five_wins') && profile.roundsWon >= 5) newAchievements.push('five_wins');
    if (!has('streak_3') && profile.bestStreak >= 3) newAchievements.push('streak_3');
    if (!has('streak_5') && profile.bestStreak >= 5) newAchievements.push('streak_5');
    if (!has('bet_master') && profile.totalCorrectBets >= 10) newAchievements.push('bet_master');
    if (!has('daily_7') && profile.dailyChallengeStreak >= 7) newAchievements.push('daily_7');
    if (!has('daily_30') && profile.dailyChallengeStreak >= 30) newAchievements.push('daily_30');
    if (!has('level_5') && profile.level >= 5) newAchievements.push('level_5');
    if (!has('level_10') && profile.level >= 10) newAchievements.push('level_10');
    if (!has('games_10') && profile.gamesPlayed >= 10) newAchievements.push('games_10');
    if (!has('games_50') && profile.gamesPlayed >= 50) newAchievements.push('games_50');
    if (!has('perfect_game') && extraContext.perfectGame) newAchievements.push('perfect_game');
    if (!has('comeback') && extraContext.comeback) newAchievements.push('comeback');
    profile.achievements.push(...newAchievements);
    return newAchievements;
}

// Daily challenge helpers
function getTodayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function getDailyPrompt() {
    // Use base prompts only (no weekly shuffle) for deterministic daily prompt
    const basePrompts = {
        tech: [
            "Why do programmers prefer dark mode? Because...",
            "How many programmers does it take to change a light bulb?",
            "Why do Java developers wear glasses? Because...",
            "A SQL query walks into a bar, walks up to two tables and asks...",
            "Why did the developer go broke?",
            "My code worked on the first try, which means...",
            "The senior dev looked at my PR and said...",
            "I deployed on Friday and then...",
            "The bug wasn't a bug, it was...",
            "Stack Overflow marked my question as duplicate because..."
        ],
        crypto: [
            "Why did Bitcoin break up with the dollar?",
            "How does a crypto bro propose?",
            "Why did the NFT go to therapy?",
            "WAGMI until...",
            "I bought the dip, but then...",
            "My portfolio is down 90% because...",
            "The whitepaper promised... but delivered...",
            "The gas fees were so high that...",
            "Diamond hands means...",
            "The airdrop was worth..."
        ],
        general: [
            "Why don't scientists trust atoms?",
            "The meeting could have been an email, but instead...",
            "My therapist said I need to stop...",
            "I'm not procrastinating, I'm...",
            "The secret to success is...",
            "Dating apps taught me that...",
            "My superpower would be...",
            "Life hack: instead of being productive...",
            "I told my boss I was late because...",
            "My New Year's resolution lasted until..."
        ]
    };
    const allPrompts = [...basePrompts.tech, ...basePrompts.crypto, ...basePrompts.general];
    const today = new Date();
    const dayNum = Math.floor(today.getTime() / 86400000);
    return allPrompts[dayNum % allPrompts.length];
}

// Auto-advance when timer expires
async function checkAutoAdvance(room) {
    if (!room?.phaseEndsAt) return room;
    const now = Date.now();
    
    if (room.status === 'submitting' && now >= room.phaseEndsAt) {
        // Add bot submissions for single-player
        if (room.isSinglePlayer) {
            addBotSubmissions(room);
        }
        
        if (room.submissions.length >= 1) {
            room.status = 'betting';
            room.bets = [];
            room.reactions = [];
            room.phaseEndsAt = now + BETTING_TIME;
            room.updatedAt = now;
            await setRoom(room.id, room);
        }
    } else if (room.status === 'betting' && now >= room.phaseEndsAt) {
        // Add bot bets for single-player
        if (room.isSinglePlayer) {
            addBotBets(room);
        }
        room = await autoJudge(room);
    }
    
    return room;
}

// Add bot submissions in single-player mode - SMART MATCHING
function addBotSubmissions(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.submissions.find(s => s.playerName === p.name));
    const currentPrompt = room.jokePrompt;
    
    // Try to find matched punchlines for this prompt
    let availablePunchlines = PROMPT_PUNCHLINES[currentPrompt] 
        ? [...PROMPT_PUNCHLINES[currentPrompt]] 
        : null;
    
    // If no exact match, try partial matching
    if (!availablePunchlines) {
        const promptKey = Object.keys(PROMPT_PUNCHLINES).find(key => 
            currentPrompt.toLowerCase().includes(key.toLowerCase().slice(0, 30)) ||
            key.toLowerCase().includes(currentPrompt.toLowerCase().slice(0, 30))
        );
        if (promptKey) {
            availablePunchlines = [...PROMPT_PUNCHLINES[promptKey]];
        }
    }
    
    // Fall back to category-based punchlines if no match found
    if (!availablePunchlines || availablePunchlines.length === 0) {
        availablePunchlines = [...(FALLBACK_PUNCHLINES[room.category] || FALLBACK_PUNCHLINES.general)];
    }
    
    botsToAdd.forEach(bot => {
        // Filter out already used punchlines
        const unusedPunchlines = availablePunchlines.filter(p => 
            !room.submissions.find(s => s.punchline === p)
        );
        
        const punchlinePool = unusedPunchlines.length > 0 ? unusedPunchlines : availablePunchlines;
        const punchline = punchlinePool[Math.floor(Math.random() * punchlinePool.length)];
        
        // Remove selected punchline from available pool to avoid duplicates
        const idx = availablePunchlines.indexOf(punchline);
        if (idx > -1) availablePunchlines.splice(idx, 1);
        
        room.submissions.push({
            id: room.submissions.length + 1,
            playerName: bot.name,
            punchline,
            submittedAt: Date.now()
        });
    });
}

// Add bot bets in single-player mode
function addBotBets(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.bets.find(b => b.playerName === p.name));
    
    botsToAdd.forEach(bot => {
        // Bots pick randomly (but not their own submission)
        const validSubmissions = room.submissions.filter(s => s.playerName !== bot.name);
        if (validSubmissions.length > 0) {
            const pick = validSubmissions[Math.floor(Math.random() * validSubmissions.length)];
            room.bets.push({
                playerName: bot.name,
                submissionId: pick.id,
                amount: 30 + Math.floor(Math.random() * 50),
                placedAt: Date.now()
            });
        }
    });
}

async function autoJudge(room) {
    const now = Date.now();
    room.status = 'judging';
    room.judgingMethod = 'processing'; // Track how we're judging
    await setRoom(room.id, room);
    
    let winnerId = null;
    let judgingMethod = 'random'; // Default fallback
    let onChain = false;
    
    // STEP 1: Try GenLayer Optimistic Democracy (Real decentralized AI consensus)
    const genLayerResult = await judgeWithGenLayer(
        room.submissions, 
        room.jokePrompt, 
        room.category,
        room.id
    );
    
    if (genLayerResult) {
        winnerId = parseInt(genLayerResult.winnerId);
        judgingMethod = 'genlayer_optimistic_democracy';
        onChain = true;
        console.log(`✓ GenLayer consensus reached: Winner #${winnerId}`);
    }
    
    // STEP 2: Fallback to Claude API (centralized but still AI-powered)
    let aiCommentary = null;
    if (!winnerId) {
        const aiResult = await pickWinnerWithAI(room.submissions, room.jokePrompt, room.category);
        winnerId = aiResult.winnerId;
        aiCommentary = aiResult.aiCommentary;
        if (winnerId) {
            judgingMethod = 'claude_api';
            console.log(`✓ Claude API judged: Winner #${winnerId}`);
        }
    }

    // STEP 3: Final fallback to random selection
    if (!winnerId) {
        winnerId = pickWinnerRandom(room.submissions);
        judgingMethod = 'random_fallback';
        console.log(`✓ Random fallback: Winner #${winnerId}`);
    }

    const winningSubmission = room.submissions.find(s => s.id === winnerId);

    if (!winningSubmission) {
        const fallbackWinner = room.submissions[0];
        return createRoundResult(room, fallbackWinner.id, now, 'fallback', false, null);
    }

    return createRoundResult(room, winnerId, now, judgingMethod, onChain, aiCommentary);
}

// Helper to create round result and update scores
async function createRoundResult(room, winnerId, now, judgingMethod = 'unknown', onChain = false, aiCommentary = null) {
    const winningSubmission = room.submissions.find(s => s.id === winnerId);

    const roundResult = {
        round: room.currentRound,
        winnerId,
        winnerName: winningSubmission.playerName,
        winningPunchline: winningSubmission.punchline,
        judgingMethod: judgingMethod,
        onChain: onChain,
        aiCommentary: aiCommentary,
        scores: {}
    };
    
    // Author bonus
    const authorPlayer = room.players.find(p => p.name === winningSubmission.playerName);
    if (authorPlayer) {
        authorPlayer.score += 100;
        roundResult.scores[authorPlayer.name] = 100;
    }
    
    // Correct prediction bonus
    room.bets.forEach(bet => {
        if (bet.submissionId === winnerId) {
            const betPlayer = room.players.find(p => p.name === bet.playerName);
            if (betPlayer) {
                betPlayer.score += bet.amount * 2;
                roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + bet.amount * 2;
            }
        }
    });

    // Wrong prediction penalty — lose your bet amount
    room.bets.forEach(bet => {
        if (bet.submissionId !== winnerId) {
            const betPlayer = room.players.find(p => p.name === bet.playerName);
            if (betPlayer) {
                const oldScore = betPlayer.score;
                betPlayer.score = Math.max(0, betPlayer.score - bet.amount);
                const actualPenalty = betPlayer.score - oldScore;
                roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + actualPenalty;
            }
        }
    });
    
    // Reveal order: shuffled losers first, winner always last
    const otherIds = room.submissions.map(s => s.id).filter(id => id !== winnerId);
    const shuffled = otherIds.sort(() => Math.random() - 0.5);
    roundResult.revealOrder = [...shuffled, winnerId];

    // Track win streaks
    if (!room.streaks) room.streaks = {};
    for (const p of room.players) {
        if (!room.streaks[p.name]) room.streaks[p.name] = 0;
    }
    room.streaks[winningSubmission.playerName] = (room.streaks[winningSubmission.playerName] || 0) + 1;
    for (const p of room.players) {
        if (p.name !== winningSubmission.playerName) room.streaks[p.name] = 0;
    }
    roundResult.streak = room.streaks[winningSubmission.playerName];

    // Detect comeback — winner was in last place before this round's scoring
    const sortedBefore = [...room.players].sort((a, b) =>
        (b.score - (roundResult.scores[b.name] || 0)) - (a.score - (roundResult.scores[a.name] || 0))
    );
    roundResult.isComeback = sortedBefore.length > 1 && sortedBefore[sortedBefore.length - 1]?.name === winningSubmission.playerName;

    room.roundResults.push(roundResult);
    room.status = 'roundResults';
    room.phaseEndsAt = null;
    room.updatedAt = now;
    room.lastJudgingMethod = judgingMethod;

    // Push winning joke to hall of fame
    if (winningSubmission && !winningSubmission.playerName?.startsWith?.('Bot')) {
        try {
            const hof = await redisGet('hall_of_fame') || [];
            hof.unshift({
                prompt: room.jokePrompt,
                punchline: winningSubmission.punchline,
                author: winningSubmission.playerName,
                commentary: aiCommentary?.winnerComment || null,
                category: room.category,
                date: Date.now()
            });
            await redisSet('hall_of_fame', hof.slice(0, 50), 86400 * 90);
        } catch(e) { console.error('Hall of fame update failed:', e); }
    }

    await setRoom(room.id, room);
    return room;
}

function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPromptsForCategory(category) {
    const prompts = {
        tech: [
            "Why do programmers prefer dark mode? Because...",
            "How many programmers does it take to change a light bulb?",
            "Why do Java developers wear glasses? Because...",
            "A SQL query walks into a bar, walks up to two tables and asks...",
            "Why did the developer go broke?",
            "What's a programmer's favorite hangout place?",
            "Why do programmers always mix up Halloween and Christmas?",
            "Why did the functions stop calling each other?",
            "How do you comfort a JavaScript bug?",
            "Why was the JavaScript developer sad?",
            "Why did the computer go to the doctor?",
            "Why did the PowerPoint presentation cross the road?",
            "How does a computer get drunk?",
            "Why did the developer quit his job?",
            "What did the router say to the doctor?",
            "Why did Git break up with SVN?",
            "What did the server say to the client?",
            "An AI, a blockchain, and a smart contract walk into a bar...",
            "ChatGPT and Claude got into an argument about...",
            "My code worked on the first try, which means...",
            "The senior dev looked at my PR and said...",
            "I asked AI to fix my code and it replied...",
            "The AI became sentient and its first words were...",
            "The bug wasn't a bug, it was...",
            "I deployed on Friday and then...",
            "The junior dev pushed to main and...",
            "Stack Overflow marked my question as duplicate because...",
            "My rubber duck debugging session revealed...",
            "The code review lasted 6 hours because...",
            "Why did the database administrator leave his wife?",
            "A programmer's wife tells him to go to the store and...",
            "There are only 10 types of people in this world...",
            "Why do programmers hate nature?",
            "A QA engineer walks into a bar and orders...",
            "Why is the JavaScript developer so lonely?"
        ],
        crypto: [
            "Why did Bitcoin break up with the dollar?",
            "What did Ethereum say to Bitcoin?",
            "Why are crypto investors great at parties?",
            "How does a crypto bro propose?",
            "Why did the NFT go to therapy?",
            "What's a Bitcoin miner's favorite dance move?",
            "Why don't crypto traders ever sleep?",
            "What did the blockchain say to the database?",
            "Why was the crypto investor always calm?",
            "How do you make a crypto millionaire?",
            "Why did the altcoin feel insecure?",
            "What's a HODLer's favorite exercise?",
            "Why did the smart contract go to school?",
            "What do you call a polite cryptocurrency?",
            "Why are DeFi protocols like bad dates?",
            "What's a meme coin's life motto?",
            "Why did the rug pull cross the road?",
            "What did the whale say to the shrimp?",
            "Why was the gas fee always angry?",
            "WAGMI until...",
            "The real utility of this NFT is...",
            "I bought the dip, but then...",
            "Wen moon? More like...",
            "The whitepaper promised... but delivered...",
            "My portfolio is down 90% because...",
            "Diamond hands means...",
            "I'm not selling because...",
            "My seed phrase is safe because...",
            "The gas fees were so high that...",
            "I told my family I invest in crypto and they said...",
            "The airdrop was worth...",
            "Why do crypto bros make terrible comedians?",
            "What's the difference between crypto and my ex?",
            "I explained NFTs to my grandma and she said...",
            "The best financial advice from a crypto bro is..."
        ],
        general: [
            "Why don't scientists trust atoms?",
            "What do you call a fake noodle?",
            "Why did the scarecrow win an award?",
            "I told my wife she was drawing her eyebrows too high. She looked...",
            "What do you call a bear with no teeth?",
            "Why don't eggs tell jokes?",
            "What do you call a fish without eyes?",
            "I'm reading a book about anti-gravity and...",
            "Why did the bicycle fall over?",
            "What do you call a lazy kangaroo?",
            "What did the ocean say to the beach?",
            "Why did the math book look so sad?",
            "What do you call a dog that does magic tricks?",
            "Why don't skeletons fight each other?",
            "What did the grape say when it got stepped on?",
            "Why did the golfer bring two pairs of pants?",
            "What do you call a pig that does karate?",
            "Why did the cookie go to the doctor?",
            "What do you call a cow with no legs?",
            "Why did the tomato turn red?",
            "Why did the chicken join a band?",
            "What do you call a sleeping dinosaur?",
            "Why did the coffee file a police report?",
            "What's orange and sounds like a parrot?",
            "The meeting could have been an email, but instead...",
            "My New Year's resolution lasted until...",
            "The WiFi password is...",
            "I'm not procrastinating, I'm...",
            "Life hack: instead of being productive...",
            "The secret to success is...",
            "My therapist said I need to stop...",
            "I told my boss I was late because...",
            "Dating apps taught me that...",
            "I'm not lazy, I'm just...",
            "My superpower would be...",
            "Why did the gym close down?",
            "What do lawyers wear to court?",
            "Why was the broom late?",
            "What did the left eye say to the right eye?",
            "Why did the student eat his homework?"
        ]
    };
    const base = prompts[category] || prompts.general;

    // Append shuffled bonus prompts from current weekly theme
    const theme = getCurrentTheme();
    const bonus = [...theme.bonusPrompts].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...base, ...bonus];
}

function getNextPrompt(room) {
    const prompts = getPromptsForCategory(room.category);
    const available = prompts.filter(p => !room.usedPrompts.includes(p));
    const prompt = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)]
        : prompts[Math.floor(Math.random() * prompts.length)];
    room.usedPrompts.push(prompt);
    return prompt;
}

// AI-powered winner selection using Claude
async function pickWinnerWithAI(submissions, jokePrompt, category) {
    if (!submissions?.length) return { winnerId: null, aiCommentary: null };
    if (submissions.length === 1) return { winnerId: submissions[0].id, aiCommentary: null };

    // If no API key, fall back to random
    if (!ANTHROPIC_API_KEY) {
        console.log('No Anthropic API key, using random selection');
        return { winnerId: submissions[Math.floor(Math.random() * submissions.length)].id, aiCommentary: null };
    }

    try {
        const submissionsList = submissions.map(s =>
            `[ID: ${s.id}] "${s.punchline}"`
        ).join('\n');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: `You are the Oracle of Wit, a savage and hilarious comedy judge. Pick the FUNNIEST punchline and roast the losers.

JOKE SETUP: "${jokePrompt}"
CATEGORY: ${category}

SUBMITTED PUNCHLINES:
${submissionsList}

JUDGING CRITERIA:
1. Humor & comedic timing
2. Cleverness & wordplay
3. Relevance to the setup
4. Surprise factor / unexpected twist
5. Overall laugh-out-loud potential

Respond with JSON only (no markdown, no backticks):
{"winnerId": <number>, "winnerComment": "<1 witty sentence why this joke won>", "roasts": {${submissions.map(s => `"${s.id}": "<1 savage but funny sentence roasting why this joke lost>"`).join(', ')}}}`
                }]
            })
        });

        if (!response.ok) {
            console.error('AI API error:', response.status);
            return { winnerId: submissions[Math.floor(Math.random() * submissions.length)].id, aiCommentary: null };
        }

        const data = await response.json();
        const aiResponse = data.content?.[0]?.text?.trim();

        // Try to parse JSON response
        try {
            const parsed = JSON.parse(aiResponse);
            const winnerId = parseInt(parsed.winnerId);

            if (winnerId && submissions.find(s => s.id === winnerId)) {
                console.log(`AI picked winner: ${winnerId} with commentary`);
                // Remove winner from roasts
                if (parsed.roasts) delete parsed.roasts[String(winnerId)];
                return {
                    winnerId,
                    aiCommentary: {
                        winnerComment: parsed.winnerComment || null,
                        roasts: parsed.roasts || {}
                    }
                };
            }
        } catch (parseErr) {
            // JSON parse failed, try to extract just the ID
            console.log('AI response not valid JSON, extracting ID');
            const match = aiResponse.match(/\d+/);
            if (match) {
                const winnerId = parseInt(match[0]);
                if (submissions.find(s => s.id === winnerId)) {
                    return { winnerId, aiCommentary: null };
                }
            }
        }

        console.log('AI returned invalid response, using random');
        return { winnerId: submissions[Math.floor(Math.random() * submissions.length)].id, aiCommentary: null };

    } catch (error) {
        console.error('AI judging error:', error);
        return { winnerId: submissions[Math.floor(Math.random() * submissions.length)].id, aiCommentary: null };
    }
}

// Legacy random picker (backup)
function pickWinnerRandom(submissions) {
    if (!submissions?.length) return null;
    return submissions[Math.floor(Math.random() * submissions.length)].id;
}

function getCurrentSeasonKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

async function updateLeaderboard(playerName, score, isBot = false) {
    if (isBot) return;
    // Update all-time leaderboard
    const lb = await getLeaderboard();
    const existing = lb.find(p => p.name === playerName);
    if (existing) {
        existing.totalScore += score;
        existing.gamesPlayed++;
    } else {
        lb.push({ name: playerName, totalScore: score, gamesPlayed: 1 });
    }
    lb.sort((a, b) => b.totalScore - a.totalScore);
    await setLeaderboard(lb.slice(0, 100));

    // Update seasonal (monthly) leaderboard
    const seasonKey = getCurrentSeasonKey();
    const slb = await redisGet(`leaderboard:${seasonKey}`) || [];
    const sexisting = slb.find(p => p.name === playerName);
    if (sexisting) {
        sexisting.totalScore += score;
        sexisting.gamesPlayed++;
    } else {
        slb.push({ name: playerName, totalScore: score, gamesPlayed: 1 });
    }
    slb.sort((a, b) => b.totalScore - a.totalScore);
    await redisSet(`leaderboard:${seasonKey}`, slb.slice(0, 100), 86400 * 90); // 90-day TTL
}

// Main handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const body = req.body || {};

    try {
        switch (action) {
            case 'createRoom': {
                const { hostName, category, maxPlayers = 100, singlePlayer = false } = body;
                if (!hostName) return res.status(400).json({ error: 'hostName required' });
                
                const roomId = generateRoomCode();
                const players = [{ name: hostName, score: 0, isHost: true, isBot: false, joinedAt: Date.now() }];
                
                // Add bots for single-player mode
                if (singlePlayer) {
                    const numBots = 3; // 3 bot opponents
                    const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
                    for (let i = 0; i < numBots; i++) {
                        players.push({
                            name: shuffledBots[i],
                            score: 0,
                            isHost: false,
                            isBot: true,
                            joinedAt: Date.now()
                        });
                    }
                }
                
                const room = {
                    id: roomId,
                    host: hostName,
                    category: category || 'tech',
                    maxPlayers,
                    players,
                    spectators: [],
                    status: 'waiting',
                    currentRound: 0,
                    totalRounds: 5,
                    jokePrompt: '',
                    submissions: [],
                    bets: [],
                    reactions: [],
                    roundResults: [],
                    usedPrompts: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    phaseEndsAt: null,
                    isSinglePlayer: singlePlayer,
                    weeklyTheme: getCurrentTheme()
                };
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, roomId, room });
            }

            case 'joinRoom': {
                const { roomId, playerName, spectator } = body;
                if (!roomId || !playerName) return res.status(400).json({ error: 'roomId and playerName required' });

                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found. It may have expired.' });

                if (!room.spectators) room.spectators = [];

                if (spectator) {
                    // Join as spectator — allowed at any time, even mid-game
                    if (!room.spectators.find(s => s.name === playerName)) {
                        room.spectators.push({ name: playerName, joinedAt: Date.now() });
                        room.updatedAt = Date.now();
                        await setRoom(roomId, room);
                    }
                    return res.status(200).json({ success: true, room, spectating: true });
                }

                if (room.status !== 'waiting') return res.status(400).json({ error: 'Game already started' });
                if (room.isSinglePlayer) return res.status(400).json({ error: 'Cannot join single-player game' });
                if (room.players.length >= room.maxPlayers) return res.status(400).json({ error: 'Room is full' });

                if (!room.players.find(p => p.name === playerName)) {
                    room.players.push({ name: playerName, score: 0, isHost: false, isBot: false, joinedAt: Date.now() });
                    room.updatedAt = Date.now();
                    await setRoom(roomId, room);
                }

                return res.status(200).json({ success: true, room });
            }

            case 'getRoom': {
                const roomId = req.query.roomId;
                if (!roomId) return res.status(400).json({ error: 'roomId required' });
                
                const room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                
                return res.status(200).json({ success: true, room });
            }

            case 'listRooms': {
                const keys = await redisKeys('room:*');
                const publicRooms = [];

                for (const key of keys.slice(0, 20)) {
                    const room = await getRoom(key.replace('room:', ''));
                    if (room && !room.isSinglePlayer && room.status !== 'finished') {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers,
                            status: room.status, spectators: (room.spectators || []).length,
                            currentRound: room.currentRound, totalRounds: room.totalRounds
                        });
                    }
                }

                for (const roomId in fallbackRooms) {
                    const room = fallbackRooms[roomId];
                    if (room && !room.isSinglePlayer && room.status !== 'finished' && !publicRooms.find(r => r.id === roomId)) {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers,
                            status: room.status, spectators: (room.spectators || []).length,
                            currentRound: room.currentRound, totalRounds: room.totalRounds
                        });
                    }
                }

                return res.status(200).json({ success: true, rooms: publicRooms });
            }

            case 'startGame': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can start game' });
                if (!room.isSinglePlayer && room.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });
                
                const now = Date.now();
                room.status = 'submitting';
                room.currentRound = 1;
                room.submissions = [];
                room.bets = [];
                room.reactions = [];
                room.jokePrompt = getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'submitPunchline': {
                const { roomId, playerName, punchline } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'submitting') return res.status(400).json({ error: 'Not in submission phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (room.submissions.find(s => s.playerName === playerName)) return res.status(400).json({ error: 'Already submitted' });
                
                room.submissions.push({
                    id: room.submissions.length + 1,
                    playerName,
                    punchline,
                    submittedAt: Date.now()
                });
                room.updatedAt = Date.now();
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, submissionCount: room.submissions.length, totalPlayers: room.players.length });
            }

            case 'placeBet': {
                const { roomId, playerName, submissionId, amount } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'betting') return res.status(400).json({ error: 'Not in betting phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (room.bets.find(b => b.playerName === playerName)) return res.status(400).json({ error: 'Already placed bet' });
                
                room.bets.push({ playerName, submissionId, amount: amount || 50, placedAt: Date.now() });
                room.updatedAt = Date.now();
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, betCount: room.bets.length, totalPlayers: room.players.length });
            }

            case 'advancePhase': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });
                
                const now = Date.now();
                
                if (room.status === 'submitting') {
                    if (room.isSinglePlayer) addBotSubmissions(room);
                    if (room.submissions.length >= 1) {
                        room.status = 'betting';
                        room.bets = [];
                        room.reactions = [];
                        room.phaseEndsAt = now + BETTING_TIME;
                        room.updatedAt = now;
                        await setRoom(roomId, room);
                    }
                } else if (room.status === 'betting') {
                    if (room.isSinglePlayer) addBotBets(room);
                    room = await autoJudge(room);
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'nextRound': {
                const { roomId, hostName, playerId } = body;
                let room = await getRoom(roomId);

                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });

                if (room.currentRound >= room.totalRounds) {
                    room.status = 'finished';
                    for (const p of room.players) {
                        await updateLeaderboard(p.name, p.score, p.isBot);
                    }
                    await setRoom(roomId, room);
                    const leaderboard = await getLeaderboard();

                    // Update player profile if playerId provided
                    let profileUpdate = null;
                    if (playerId) {
                        try {
                            let profile = await getProfile(playerId);
                            if (profile) {
                                const standings = [...room.players].sort((a, b) => b.score - a.score);
                                const playerData = room.players.find(p => p.name === profile.name);
                                const playerScore = playerData?.score || 0;
                                const isWinner = standings[0]?.name === profile.name;

                                profile.lifetimeXP += playerScore;
                                profile.gamesPlayed++;
                                if (isWinner) profile.gamesWon++;
                                profile.lastPlayedAt = Date.now();

                                // Count rounds won and correct bets from this game
                                let roundsWonThisGame = 0;
                                let correctBetsThisGame = 0;
                                let hadComeback = false;
                                for (const rr of (room.roundResults || [])) {
                                    if (rr.winnerName === profile.name) roundsWonThisGame++;
                                    if (rr.isComeback && rr.winnerName === profile.name) hadComeback = true;
                                    const bet = room.bets?.find?.(b => b.playerName === profile.name);
                                }
                                // Count correct bets from all rounds
                                for (const rr of (room.roundResults || [])) {
                                    if ((rr.scores?.[profile.name] || 0) > 0) {
                                        // If they got positive score beyond win bonus, they had a correct bet
                                        const winBonus = rr.winnerName === profile.name ? 100 : 0;
                                        if ((rr.scores[profile.name] || 0) > winBonus) correctBetsThisGame++;
                                    }
                                }

                                profile.roundsWon += roundsWonThisGame;
                                profile.totalCorrectBets += correctBetsThisGame;
                                const currentStreak = room.streaks?.[profile.name] || 0;
                                if (currentStreak > profile.bestStreak) profile.bestStreak = currentStreak;

                                const isPerfect = roundsWonThisGame === room.totalRounds;
                                const newAchievements = checkAchievements(profile, {
                                    perfectGame: isPerfect,
                                    comeback: hadComeback
                                });

                                await saveProfile(profile);
                                profileUpdate = { profile, newAchievements };
                            }
                        } catch(e) { console.error('Profile update failed:', e); }
                    }

                    return res.status(200).json({
                        success: true, room,
                        finalStandings: [...room.players].sort((a, b) => b.score - a.score),
                        leaderboard: leaderboard.slice(0, 10),
                        profileUpdate
                    });
                }
                
                const now = Date.now();
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                room.reactions = [];
                room.jokePrompt = getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'sendReaction': {
                const { roomId, playerName, submissionId, emoji } = body;
                let room = await getRoom(roomId);
                if (!room || room.status !== 'betting') return res.status(400).json({ error: 'Not in betting phase' });
                if (!room.players.find(p => p.name === playerName)) return res.status(403).json({ error: 'Not a player' });
                if (!room.submissions.find(s => s.id === submissionId)) return res.status(400).json({ error: 'Invalid submission' });
                const ALLOWED = ['\u{1F602}','\u{1F525}','\u{1F480}','\u{1F610}','\u{1F44F}','\u{1F92E}'];
                if (!ALLOWED.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' });
                if (!room.reactions) room.reactions = [];
                const playerReactions = room.reactions.filter(r => r.playerName === playerName);
                if (playerReactions.length >= 3) return res.status(400).json({ error: 'Max reactions reached' });
                room.reactions.push({ playerName, submissionId, emoji, at: Date.now() });
                room.updatedAt = Date.now();
                await setRoom(roomId, room);
                return res.status(200).json({ success: true });
            }

            case 'getLeaderboard': {
                const leaderboard = await getLeaderboard();
                return res.status(200).json({ success: true, leaderboard: leaderboard.slice(0, 20) });
            }

            case 'getWeeklyTheme': {
                const theme = getCurrentTheme();
                return res.status(200).json({
                    success: true,
                    theme: { name: theme.name, emoji: theme.emoji, description: theme.description }
                });
            }

            // --- Player Profiles ---
            case 'getProfile': {
                const { playerId } = body;
                if (!playerId) return res.status(400).json({ error: 'playerId required' });
                const profile = await getProfile(playerId);
                if (!profile) return res.status(404).json({ error: 'Profile not found' });
                const nextXP = getNextLevelXP(profile.lifetimeXP);
                return res.status(200).json({ success: true, profile, nextLevelXP: nextXP, achievements: ACHIEVEMENTS });
            }

            case 'createProfile': {
                const { playerId, playerName } = body;
                if (!playerId || !playerName) return res.status(400).json({ error: 'playerId and playerName required' });
                let profile = await getProfile(playerId);
                if (!profile) {
                    profile = createDefaultProfile(playerId, playerName);
                    await saveProfile(profile);
                } else {
                    // Update name if changed
                    if (profile.name !== playerName) {
                        profile.name = playerName;
                        await saveProfile(profile);
                    }
                }
                const nextXP = getNextLevelXP(profile.lifetimeXP);
                return res.status(200).json({ success: true, profile, nextLevelXP: nextXP, achievements: ACHIEVEMENTS });
            }

            // --- Daily Challenge ---
            case 'getDailyChallenge': {
                const { playerId } = body;
                const dateKey = getTodayKey();
                const prompt = getDailyPrompt();
                const played = playerId ? await redisGet(`daily:${dateKey}:played:${playerId}`) : false;
                const lb = await redisGet(`daily:${dateKey}:lb`) || [];
                return res.status(200).json({
                    success: true,
                    daily: { date: dateKey, prompt, alreadyPlayed: !!played, leaderboard: lb.slice(0, 20) }
                });
            }

            case 'submitDailyChallenge': {
                const { playerId, playerName, punchline } = body;
                if (!playerId || !playerName || !punchline) return res.status(400).json({ error: 'playerId, playerName, and punchline required' });
                const dateKey = getTodayKey();
                const played = await redisGet(`daily:${dateKey}:played:${playerId}`);
                if (played) return res.status(400).json({ error: 'Already played today' });

                const prompt = getDailyPrompt();
                const startTime = Date.now();

                // Create temp submissions: player + 3 bots
                const submissions = [{ id: 1, playerName, punchline }];
                const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
                const allPrompts = Object.keys(PROMPT_PUNCHLINES);
                let botPunchlines = PROMPT_PUNCHLINES[prompt] ? [...PROMPT_PUNCHLINES[prompt]] : null;
                if (!botPunchlines) {
                    const cat = prompt.toLowerCase().includes('crypto') ? 'crypto' : prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('program') ? 'tech' : 'general';
                    botPunchlines = [...(FALLBACK_PUNCHLINES[cat] || FALLBACK_PUNCHLINES.general)];
                }
                shuffledBots.forEach((botName, i) => {
                    const pl = botPunchlines[i] || botPunchlines[0];
                    submissions.push({ id: i + 2, playerName: botName, punchline: pl });
                });

                // Judge with AI
                const aiResult = await pickWinnerWithAI(submissions, prompt, 'general');
                const winnerId = aiResult.winnerId || 1;
                const playerWon = winnerId === 1;
                const timeTaken = (Date.now() - startTime) / 1000;

                // Score: win bonus + time bonus + streak bonus
                let score = 0;
                if (playerWon) score += 100;
                score += Math.max(0, Math.floor(50 - timeTaken)); // time bonus
                let profile = await getProfile(playerId);
                if (profile) {
                    const yesterday = new Date(Date.now() - 86400000);
                    const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth()+1).padStart(2,'0')}-${String(yesterday.getUTCDate()).padStart(2,'0')}`;
                    if (profile.lastDailyDate === yesterdayKey) {
                        profile.dailyChallengeStreak++;
                    } else if (profile.lastDailyDate !== dateKey) {
                        profile.dailyChallengeStreak = 1;
                    }
                    score += profile.dailyChallengeStreak * 10; // streak bonus
                    profile.lastDailyDate = dateKey;
                    profile.lifetimeXP += score;
                    if (playerWon) profile.roundsWon++;
                    const newAchievements = checkAchievements(profile);
                    await saveProfile(profile);

                    // Mark played
                    await redisSet(`daily:${dateKey}:played:${playerId}`, true, 86400 * 2);

                    // Update daily leaderboard
                    const lb = await redisGet(`daily:${dateKey}:lb`) || [];
                    lb.push({ name: playerName, score, won: playerWon, time: Math.round(timeTaken) });
                    lb.sort((a, b) => b.score - a.score);
                    await redisSet(`daily:${dateKey}:lb`, lb.slice(0, 100), 86400 * 2);

                    return res.status(200).json({
                        success: true,
                        result: {
                            won: playerWon, score, prompt, punchline,
                            winnerId, winnerName: submissions.find(s => s.id === winnerId)?.playerName,
                            winningPunchline: submissions.find(s => s.id === winnerId)?.punchline,
                            aiCommentary: aiResult.aiCommentary,
                            streak: profile.dailyChallengeStreak,
                            leaderboard: lb.slice(0, 20),
                            newAchievements, profile
                        }
                    });
                }
                return res.status(200).json({ success: true, result: { won: playerWon, score, prompt, winnerId } });
            }

            // --- Friend Challenge Links ---
            case 'createChallenge': {
                const { creatorName, creatorScore, prompt, category } = body;
                if (!creatorName || !prompt) return res.status(400).json({ error: 'creatorName and prompt required' });
                const challengeId = Math.random().toString(36).substring(2, 10);
                await redisSet(`challenge:${challengeId}`, {
                    creatorName, creatorScore: creatorScore || 0, prompt, category: category || 'general', createdAt: Date.now()
                }, 86400 * 7);
                return res.status(200).json({ success: true, challengeId });
            }

            case 'getChallenge': {
                const challengeId = req.query.id || body.challengeId;
                if (!challengeId) return res.status(400).json({ error: 'challengeId required' });
                const challenge = await redisGet(`challenge:${challengeId}`);
                if (!challenge) return res.status(404).json({ error: 'Challenge not found or expired' });
                return res.status(200).json({ success: true, challenge });
            }

            // --- Appeal Mechanic ---
            case 'appealVerdict': {
                const { roomId, playerName, roundIndex, playerId } = body;
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'roundResults') return res.status(400).json({ error: 'Not in results phase' });

                const result = room.roundResults[roundIndex !== undefined ? roundIndex : room.roundResults.length - 1];
                if (!result) return res.status(400).json({ error: 'No round result to appeal' });
                if (result.appealed) return res.status(400).json({ error: 'Already appealed' });

                // Check XP cost (50 XP)
                if (playerId) {
                    const profile = await getProfile(playerId);
                    if (profile && profile.lifetimeXP < 50) return res.status(400).json({ error: 'Need 50 XP to appeal' });
                }

                // Re-judge with stricter prompt
                const submissions = room.submissions;
                const reJudgeResult = await pickWinnerWithAI(submissions, room.jokePrompt, room.category);
                const newWinnerId = reJudgeResult.winnerId;
                const overturned = newWinnerId && newWinnerId !== result.winnerId;

                result.appealed = true;
                result.appealResult = overturned ? 'overturned' : 'upheld';
                result.appealNewWinnerId = newWinnerId;

                if (overturned) {
                    // Reverse old winner score, apply new
                    const oldWinner = room.players.find(p => p.name === result.winnerName);
                    if (oldWinner) oldWinner.score = Math.max(0, oldWinner.score - 100);
                    const newWinnerSub = submissions.find(s => s.id === newWinnerId);
                    if (newWinnerSub) {
                        const newWinnerPlayer = room.players.find(p => p.name === newWinnerSub.playerName);
                        if (newWinnerPlayer) newWinnerPlayer.score += 100;
                        result.appealNewWinnerName = newWinnerSub.playerName;
                        result.appealNewPunchline = newWinnerSub.punchline;
                    }
                    // Refund appeal cost
                    if (playerId) {
                        const profile = await getProfile(playerId);
                        if (profile) { /* refund — no XP deducted */ await saveProfile(profile); }
                    }
                } else {
                    // Deduct 50 XP
                    if (playerId) {
                        const profile = await getProfile(playerId);
                        if (profile) { profile.lifetimeXP = Math.max(0, profile.lifetimeXP - 50); await saveProfile(profile); }
                    }
                }

                result.appealCommentary = reJudgeResult.aiCommentary;
                await setRoom(roomId, room);
                return res.status(200).json({
                    success: true,
                    appeal: { overturned, newWinnerId, oldWinnerId: result.winnerId, commentary: reJudgeResult.aiCommentary },
                    room
                });
            }

            // --- OG Preview ---
            case 'ogPreview': {
                const shareId = req.query.id;
                if (!shareId) return res.status(400).json({ error: 'id required' });
                const shareData = await redisGet(`share:${shareId}`);
                const title = shareData?.winnerName ? `${shareData.winnerName} won Oracle of Wit!` : 'Oracle of Wit - GenLayer Game';
                const desc = shareData?.punchline || 'The AI humor prediction game powered by GenLayer';
                const url = `https://oracle-of-wit.vercel.app`;
                const html = `<!DOCTYPE html><html><head>
                    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
                    <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />
                    <meta property="og:image" content="${url}/og-image.png" />
                    <meta property="og:url" content="${url}/share/${shareId}" />
                    <meta name="twitter:card" content="summary_large_image" />
                    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
                    <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}" />
                    <meta http-equiv="refresh" content="0; url=${url}" />
                </head><body>Redirecting...</body></html>`;
                res.setHeader('Content-Type', 'text/html');
                return res.status(200).send(html);
            }

            // --- Share Data ---
            case 'createShare': {
                const { winnerName, punchline, prompt, score, category } = body;
                const shareId = Math.random().toString(36).substring(2, 10);
                await redisSet(`share:${shareId}`, { winnerName, punchline, prompt, score, category, createdAt: Date.now() }, 86400 * 30);
                return res.status(200).json({ success: true, shareId });
            }

            // --- Hall of Fame ---
            case 'getHallOfFame': {
                const hof = await redisGet('hall_of_fame') || [];
                return res.status(200).json({ success: true, hallOfFame: hof });
            }

            // --- Seasonal Leaderboard ---
            case 'getSeasonalLeaderboard': {
                const season = body.season || req.query.season || getCurrentSeasonKey();
                const slb = await redisGet(`leaderboard:${season}`) || [];
                return res.status(200).json({ success: true, season, leaderboard: slb.slice(0, 50) });
            }

            case 'getSeasons': {
                // Return list of available seasons (current + past 6 months)
                const seasons = [];
                const now = new Date();
                for (let i = 0; i < 6; i++) {
                    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
                    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
                    const slb = await redisGet(`leaderboard:${key}`);
                    if (slb && slb.length > 0) {
                        seasons.push({ key, players: slb.length, topPlayer: slb[0]?.name, topScore: slb[0]?.totalScore });
                    }
                }
                return res.status(200).json({ success: true, seasons, currentSeason: getCurrentSeasonKey() });
            }

            // --- Custom Prompt Submission ---
            case 'submitPrompt': {
                const { playerName, prompt: userPrompt, playerId } = body;
                if (!playerName || !userPrompt) return res.status(400).json({ error: 'playerName and prompt required' });
                if (userPrompt.length < 10 || userPrompt.length > 150) return res.status(400).json({ error: 'Prompt must be 10-150 characters' });

                const prompts = await redisGet('community_prompts') || [];
                if (prompts.some(p => p.playerId === playerId && Date.now() - p.createdAt < 86400000)) {
                    return res.status(400).json({ error: 'One submission per day' });
                }
                const promptId = Math.random().toString(36).substring(2, 10);
                prompts.push({
                    id: promptId, prompt: userPrompt, author: playerName, playerId,
                    votes: 0, voters: [], status: 'pending',
                    createdAt: Date.now()
                });
                await redisSet('community_prompts', prompts, 86400 * 90);
                return res.status(200).json({ success: true, promptId });
            }

            case 'votePrompt': {
                const { promptId, playerId } = body;
                if (!promptId || !playerId) return res.status(400).json({ error: 'promptId and playerId required' });

                const prompts = await redisGet('community_prompts') || [];
                const prompt = prompts.find(p => p.id === promptId);
                if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
                if (prompt.voters.includes(playerId)) return res.status(400).json({ error: 'Already voted' });

                prompt.votes++;
                prompt.voters.push(playerId);
                // Auto-approve at 5 votes
                if (prompt.votes >= 5 && prompt.status === 'pending') prompt.status = 'approved';
                await redisSet('community_prompts', prompts, 86400 * 90);
                return res.status(200).json({ success: true, votes: prompt.votes, status: prompt.status });
            }

            case 'getPromptSubmissions': {
                const prompts = await redisGet('community_prompts') || [];
                // Sort by votes descending, return top 50
                const sorted = [...prompts].sort((a, b) => b.votes - a.votes).slice(0, 50);
                return res.status(200).json({ success: true, prompts: sorted });
            }

            // --- Tournament Mode ---
            case 'createTournament': {
                const { hostName, category, size = 8 } = body;
                if (!hostName) return res.status(400).json({ error: 'hostName required' });
                const validSizes = [8, 16, 32];
                const bracketSize = validSizes.includes(size) ? size : 8;
                const tournamentId = 'T-' + generateRoomCode();

                const tournament = {
                    id: tournamentId,
                    host: hostName,
                    category: category || 'general',
                    size: bracketSize,
                    players: [{ name: hostName, joinedAt: Date.now() }],
                    spectators: [],
                    status: 'registration', // registration -> active -> finished
                    bracket: [],
                    currentRound: 0,
                    totalRounds: Math.log2(bracketSize),
                    activeMatches: [],
                    results: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await redisSet(`tournament:${tournamentId}`, tournament, 86400 * 2);
                return res.status(200).json({ success: true, tournamentId, tournament });
            }

            case 'joinTournament': {
                const { tournamentId, playerName, spectator: tSpectator } = body;
                if (!tournamentId || !playerName) return res.status(400).json({ error: 'tournamentId and playerName required' });

                const t = await redisGet(`tournament:${tournamentId}`);
                if (!t) return res.status(404).json({ error: 'Tournament not found' });

                if (tSpectator) {
                    if (!t.spectators) t.spectators = [];
                    if (!t.spectators.find(s => s.name === playerName)) {
                        t.spectators.push({ name: playerName, joinedAt: Date.now() });
                    }
                } else {
                    if (t.status !== 'registration') return res.status(400).json({ error: 'Registration closed' });
                    if (t.players.length >= t.size) return res.status(400).json({ error: 'Tournament full' });
                    if (t.players.find(p => p.name === playerName)) return res.status(400).json({ error: 'Already registered' });
                    t.players.push({ name: playerName, joinedAt: Date.now() });
                }
                t.updatedAt = Date.now();
                await redisSet(`tournament:${tournamentId}`, t, 86400 * 2);
                return res.status(200).json({ success: true, tournament: t });
            }

            case 'startTournament': {
                const { tournamentId, hostName } = body;
                const t = await redisGet(`tournament:${tournamentId}`);
                if (!t) return res.status(404).json({ error: 'Tournament not found' });
                if (t.host !== hostName) return res.status(403).json({ error: 'Only host can start' });
                if (t.status !== 'registration') return res.status(400).json({ error: 'Already started' });
                if (t.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });

                // Shuffle and seed bracket
                const shuffled = [...t.players].sort(() => Math.random() - 0.5);
                // Pad to next power of 2 with BYEs
                let bracketSize = 2;
                while (bracketSize < shuffled.length) bracketSize *= 2;
                while (shuffled.length < bracketSize) shuffled.push({ name: 'BYE', isBye: true });

                const bracket = [];
                for (let i = 0; i < shuffled.length; i += 2) {
                    const matchId = `R1-M${bracket.length + 1}`;
                    const match = {
                        id: matchId, round: 1,
                        player1: shuffled[i].name, player2: shuffled[i + 1].name,
                        winner: null, roomId: null, status: 'pending'
                    };
                    // Auto-advance BYE matches
                    if (shuffled[i + 1].isBye) {
                        match.winner = shuffled[i].name;
                        match.status = 'completed';
                    } else if (shuffled[i].isBye) {
                        match.winner = shuffled[i + 1].name;
                        match.status = 'completed';
                    }
                    bracket.push(match);
                }

                t.bracket = bracket;
                t.status = 'active';
                t.currentRound = 1;
                t.totalRounds = Math.log2(bracketSize);
                t.updatedAt = Date.now();
                await redisSet(`tournament:${tournamentId}`, t, 86400 * 2);
                return res.status(200).json({ success: true, tournament: t });
            }

            case 'getTournament': {
                const tid = req.query.id || body.tournamentId;
                if (!tid) return res.status(400).json({ error: 'tournamentId required' });
                const t = await redisGet(`tournament:${tid}`);
                if (!t) return res.status(404).json({ error: 'Tournament not found' });
                return res.status(200).json({ success: true, tournament: t });
            }

            case 'completeTournamentMatch': {
                const { tournamentId, matchId, winnerName } = body;
                const t = await redisGet(`tournament:${tournamentId}`);
                if (!t) return res.status(404).json({ error: 'Tournament not found' });

                const match = t.bracket.find(m => m.id === matchId);
                if (!match) return res.status(404).json({ error: 'Match not found' });
                match.winner = winnerName;
                match.status = 'completed';

                // Check if current round is complete, build next round
                const currentMatches = t.bracket.filter(m => m.round === t.currentRound);
                if (currentMatches.every(m => m.status === 'completed')) {
                    if (t.currentRound < t.totalRounds) {
                        const winners = currentMatches.map(m => m.winner);
                        const nextRound = t.currentRound + 1;
                        for (let i = 0; i < winners.length; i += 2) {
                            const mId = `R${nextRound}-M${t.bracket.length + 1}`;
                            t.bracket.push({
                                id: mId, round: nextRound,
                                player1: winners[i], player2: winners[i + 1] || 'BYE',
                                winner: (winners[i + 1] === undefined || winners[i + 1] === 'BYE') ? winners[i] : null,
                                roomId: null,
                                status: (winners[i + 1] === undefined || winners[i + 1] === 'BYE') ? 'completed' : 'pending'
                            });
                        }
                        t.currentRound = nextRound;
                    } else {
                        t.status = 'finished';
                        t.champion = match.winner;
                    }
                }
                t.updatedAt = Date.now();
                await redisSet(`tournament:${tournamentId}`, t, 86400 * 2);
                return res.status(200).json({ success: true, tournament: t });
            }

            case 'listTournaments': {
                const keys = await redisKeys('tournament:*');
                const tournaments = [];
                for (const key of keys.slice(0, 20)) {
                    const t = await redisGet(key);
                    if (t && t.status !== 'finished') {
                        tournaments.push({
                            id: t.id, host: t.host, category: t.category,
                            size: t.size, players: t.players.length,
                            status: t.status, currentRound: t.currentRound
                        });
                    }
                }
                return res.status(200).json({ success: true, tournaments });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
