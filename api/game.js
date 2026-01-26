// Oracle of Wit API - Supports Multiplayer & Single-Player
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const SUBMISSION_TIME = 40000;
const BETTING_TIME = 30000;

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
    
    const winnerId = pickWinner(room.submissions);
    const winningSubmission = room.submissions.find(s => s.id === winnerId);
    
    const roundResult = {
        round: room.currentRound,
        winnerId,
        winnerName: winningSubmission.playerName,
        winningPunchline: winningSubmission.punchline,
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
    
    room.roundResults.push(roundResult);
    room.status = 'roundResults';
    room.phaseEndsAt = null;
    room.updatedAt = now;
    
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
    return prompts[category] || prompts.general;
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

function pickWinner(submissions) {
    if (!submissions?.length) return null;
    return submissions[Math.floor(Math.random() * submissions.length)].id;
}

async function updateLeaderboard(playerName, score, isBot = false) {
    if (isBot) return; // Don't add bots to leaderboard
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
                const { hostName, category, maxPlayers = 10, singlePlayer = false } = body;
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
                    status: 'waiting',
                    currentRound: 0,
                    totalRounds: 3,
                    jokePrompt: '',
                    submissions: [],
                    bets: [],
                    roundResults: [],
                    usedPrompts: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    phaseEndsAt: null,
                    isSinglePlayer: singlePlayer
                };
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, roomId, room });
            }

            case 'joinRoom': {
                const { roomId, playerName } = body;
                if (!roomId || !playerName) return res.status(400).json({ error: 'roomId and playerName required' });
                
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found. It may have expired.' });
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
                    if (room && room.status === 'waiting' && !room.isSinglePlayer) {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers
                        });
                    }
                }
                
                for (const roomId in fallbackRooms) {
                    const room = fallbackRooms[roomId];
                    if (room?.status === 'waiting' && !room.isSinglePlayer && !publicRooms.find(r => r.id === roomId)) {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers
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
                const { roomId, hostName } = body;
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
                    return res.status(200).json({ 
                        success: true, room,
                        finalStandings: [...room.players].sort((a, b) => b.score - a.score),
                        leaderboard: leaderboard.slice(0, 10)
                    });
                }
                
                const now = Date.now();
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                room.jokePrompt = getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'getLeaderboard': {
                const leaderboard = await getLeaderboard();
                return res.status(200).json({ success: true, leaderboard: leaderboard.slice(0, 20) });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
