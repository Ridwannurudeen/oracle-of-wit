// Game constants: timers, levels, achievements, themes, bot names, prompt punchlines

/** @type {number} Default submission phase duration in ms */
export const SUBMISSION_TIME = parseInt(process.env.SUBMISSION_TIME) || 40000;
/** @type {number} Default betting phase duration in ms */
export const BETTING_TIME = parseInt(process.env.BETTING_TIME) || 30000;

/** @type {number[]} Allowed round counts */
export const ALLOWED_ROUNDS = [3, 5, 7, 10];
/** @type {number[]} Allowed submission times in ms */
export const ALLOWED_SUBMISSION_TIMES = [30000, 45000, 60000];
/** @type {number[]} Allowed betting times in ms */
export const ALLOWED_BETTING_TIMES = [20000, 30000, 45000];

/** @type {{totalRounds: number, submissionTime: number, bettingTime: number}} Speed mode presets */
export const SPEED_MODE = { totalRounds: 3, submissionTime: 20000, bettingTime: 15000 };

/** @type {import('./types.js').LevelThreshold[]} */
export const LEVEL_THRESHOLDS = [
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

/** @type {import('./types.js').Achievement[]} */
export const ACHIEVEMENTS = [
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

export const WEEKLY_THEMES = [
    {
        name: 'Roast the AI',
        emoji: '\u{1F916}',
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
        emoji: '\u{1F4B8}',
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
        emoji: '\u{1F3E2}',
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
        emoji: '\u{1F310}',
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
        emoji: '\u{1F680}',
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
        emoji: '\u{26D3}\u{FE0F}',
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

/** @type {string[]} */
export const BOT_NAMES = ['WittyBot', 'JokesMaster', 'PunLord', 'ComedyAI', 'LaughBot', 'HumorEngine'];

/** @type {Object<string, string[]>} Map of joke prompts to their punchline options */
export const PROMPT_PUNCHLINES = {
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

/** @type {Object<string, string[]>} Fallback punchlines by category when no prompt-specific ones exist */
export const FALLBACK_PUNCHLINES = {
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

/**
 * Derive categorized prompt lists from PROMPT_PUNCHLINES keys (single source of truth).
 * @returns {{tech: string[], crypto: string[], general: string[]}}
 */
function categorizePrompts() {
    const techKw = ['program', 'code', 'developer', 'javascript', 'java ', 'sql', 'git', 'server', 'AI ', 'ai ', 'bug', 'deploy', 'stack overflow', 'rubber duck', 'code review', 'database', 'QA ', 'computer', 'powerpoint', 'router', 'chatgpt', 'claude', 'binary', 'function'];
    const cryptoKw = ['bitcoin', 'ethereum', 'crypto', 'nft', 'defi', 'blockchain', 'token', 'coin', 'wallet', 'hodl', 'rug pull', 'whale', 'gas fee', 'wagmi', 'airdrop', 'whitepaper', 'portfolio', 'seed phrase', 'altcoin', 'miner', 'dip', 'moon', 'diamond hands', 'selling'];

    const result = { tech: [], crypto: [], general: [] };
    for (const prompt of Object.keys(PROMPT_PUNCHLINES)) {
        const lower = prompt.toLowerCase();
        if (techKw.some(kw => lower.includes(kw))) result.tech.push(prompt);
        else if (cryptoKw.some(kw => lower.includes(kw))) result.crypto.push(prompt);
        else result.general.push(prompt);
    }
    return result;
}

/** @type {{tech: string[], crypto: string[], general: string[]}} */
export const CATEGORIZED_PROMPTS = categorizePrompts();

/**
 * Get the current ISO week number.
 * @returns {number}
 */
export function getCurrentWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000;
    return Math.floor(diff / oneWeek);
}

/**
 * Get the current weekly theme based on the week number.
 * @returns {import('./types.js').WeeklyTheme}
 */
export function getCurrentTheme() {
    const weekNum = getCurrentWeekNumber();
    return WEEKLY_THEMES[weekNum % WEEKLY_THEMES.length];
}

/** @type {Object<string, {quality: number}>} Punchline quality scores for bot difficulty tiers */
export const PUNCHLINE_QUALITY = {};
// Pre-score punchlines: first in each array = best (index 0 = quality 1.0, last = 0.25)
for (const [prompt, punchlines] of Object.entries(PROMPT_PUNCHLINES)) {
    punchlines.forEach((pl, i) => {
        PUNCHLINE_QUALITY[pl] = { quality: 1.0 - (i / punchlines.length) * 0.75 };
    });
}
