// Game logic: judging, round results, phase transitions, bots, prompts

import { redisGet, redisSet, redisSetNX, redisDel } from './redis.js';
import { SUBMISSION_TIME, BETTING_TIME, VOTING_TIME, CURATION_THRESHOLD, BOT_NAMES, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES, WEEKLY_THEMES, getCurrentTheme } from './constants.js';

const BOT_FALLBACK_QUIPS = [
    "...and that's why we can't have nice things.",
    "...but nobody clapped.",
    "...my therapist needs a therapist now.",
    "...and everyone just stared.",
    "...I'm still processing it."
];
import { pickWinnerWithAI, curateSubmissions, generateBotPunchlines, pickWinnerRandom } from './ai.js';
import { submitToGenLayer, pollGenLayerResult } from './genlayer.js';

// --- Phase transitions ---

export async function transitionFromSubmitting(room, setRoom) {
    const now = Date.now();
    if (room.isSinglePlayer) await addBotSubmissions(room);
    if (room.submissions.length < 1) {
        room.status = 'roundResults';
        room.roundResults = room.roundResults || [];
        room.roundResults.push({ round: room.currentRound, winnerId: null, winnerName: 'No one', winningPunchline: 'No submissions', scores: {}, judgingMethod: 'skipped' });
        return;
    }

    if (room.submissions.length >= CURATION_THRESHOLD) {
        room.status = 'curating';
        room.updatedAt = now;
        room.phaseEndsAt = now + 6000;
        room.curatedIds = null;
        room.audienceVotes = {};
        await setRoom(room.id, room);
        return;
    }

    room.status = 'betting';
    room.bets = [];
    room.reactions = [];
    room.phaseEndsAt = now + BETTING_TIME;
    room.updatedAt = now;
    await setRoom(room.id, room);
}

export async function checkAutoAdvance(room, setRoom) {
    if (!room?.phaseEndsAt) return room;
    const now = Date.now();

    if (room.status === 'submitting' && now >= room.phaseEndsAt) {
        await transitionFromSubmitting(room, setRoom);
    } else if (room.status === 'curating' && now >= room.phaseEndsAt) {
        if (!room.curatedIds) {
            const ids = await curateSubmissions(room.submissions, room.jokePrompt, room.category);
            if (ids) {
                room.curatedIds = ids;
            } else {
                const shuffled = [...room.submissions].sort(() => Math.random() - 0.5);
                room.curatedIds = shuffled.slice(0, 8).map(s => s.id);
            }
        }
        room.status = 'voting';
        room.audienceVotes = {};
        room.phaseEndsAt = now + VOTING_TIME;
        room.updatedAt = now;
        await setRoom(room.id, room);
    } else if (room.status === 'voting' && now >= room.phaseEndsAt) {
        room = await tallyVotesAndJudge(room, setRoom);
    } else if (room.status === 'betting' && now >= room.phaseEndsAt) {
        if (room.isSinglePlayer) {
            addBotBets(room);
            await setRoom(room.id, room);
        }
        room = await autoJudge(room, setRoom);
    }

    return room;
}

// --- Distributed lock for auto-advance (replaces in-memory Set) ---

export async function acquireAdvanceLock(roomId) {
    return await redisSetNX(`lock:advance:${roomId}`, 1, 120);
}

export async function releaseAdvanceLock(roomId) {
    return await redisDel(`lock:advance:${roomId}`);
}

// --- Judging ---

export async function autoJudge(room, setRoom) {
    const now = Date.now();
    room.status = 'judging';
    room.judgingMethod = 'processing';
    await setRoom(room.id, room);

    const [genLayerResult, aiResult] = await Promise.all([
        submitToGenLayer(room.submissions, room.jokePrompt, room.category, room.id).catch(() => null),
        pickWinnerWithAI(room.submissions, room.jokePrompt, room.category).catch(() => ({ winnerId: null, aiCommentary: null }))
    ]);

    let winnerId = aiResult.winnerId;
    let aiCommentary = aiResult.aiCommentary;
    let judgingMethod = aiResult.judgingMethod || (winnerId ? 'claude_api' : 'coin_flip');
    let onChain = false;
    let txHash = null;
    let glOverride = false;

    // If GenLayer returned a txHash, poll for the authoritative result
    if (genLayerResult && genLayerResult.txHash) {
        txHash = genLayerResult.txHash;
        onChain = true;

        const validIds = room.submissions.map(s => s.id);
        const glWinnerId = await pollGenLayerResult(txHash, 30000);
        if (glWinnerId && validIds.includes(glWinnerId)) {
            // GenLayer is authoritative — use its result
            winnerId = glWinnerId;
            judgingMethod = 'genlayer_optimistic_democracy';
            glOverride = true;
            console.log(`\u2713 GenLayer OD authoritative winner #${winnerId} (tx: ${txHash})`);
        } else if (glWinnerId && !validIds.includes(glWinnerId)) {
            // GenLayer returned winnerId outside valid submission range
            console.warn(`[GenLayer] winnerId ${glWinnerId} not in valid range [${validIds}] — falling back to AI (tx: ${txHash})`);
            judgingMethod = winnerId ? 'ai_fallback' : judgingMethod;
        } else {
            // GenLayer timed out or returned null — fall back to Claude
            judgingMethod = winnerId ? 'ai_fallback' : judgingMethod;
            console.log(`\u2713 GenLayer submitted but poll failed, using Claude result (tx: ${txHash})`);
        }
    }

    if (winnerId) {
        console.log(`\u2713 Winner #${winnerId} — method: ${judgingMethod}, onChain: ${onChain}, glOverride: ${glOverride}`);
    }

    if (!winnerId) {
        winnerId = pickWinnerRandom(room.submissions);
        judgingMethod = 'coin_flip';
        console.error(`[Judge] BOTH AI and GenLayer failed for room ${room.id} — using coin flip. Winner #${winnerId}`);
    }

    const winningSubmission = room.submissions.find(s => s.id === winnerId);
    if (!winningSubmission) {
        const fallbackWinner = room.submissions[0];
        return createRoundResult(room, fallbackWinner.id, now, 'fallback', false, null, null, setRoom);
    }

    return createRoundResult(room, winnerId, now, judgingMethod, onChain, aiCommentary, txHash, setRoom, glOverride);
}

export async function tallyVotesAndJudge(room, setRoom) {
    const votes = room.audienceVotes || {};
    const voteCounts = {};

    for (const [playerName, submissionId] of Object.entries(votes)) {
        voteCounts[submissionId] = (voteCounts[submissionId] || 0) + 1;
    }

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    const topIds = Object.entries(voteCounts)
        .filter(([_, count]) => count === maxVotes)
        .map(([id]) => parseInt(id));

    let winnerId;
    let judgingMethod = 'audience_vote';
    let aiCommentary = null;

    if (topIds.length === 1) {
        winnerId = topIds[0];
    } else if (topIds.length > 1) {
        const tiedSubmissions = room.submissions.filter(s => topIds.includes(s.id));
        const aiResult = await pickWinnerWithAI(tiedSubmissions, room.jokePrompt, room.category);
        winnerId = aiResult.winnerId || topIds[Math.floor(Math.random() * topIds.length)];
        aiCommentary = aiResult.aiCommentary;
        judgingMethod = 'audience_vote_ai_tiebreak';
    } else {
        const curated = room.submissions.filter(s => room.curatedIds?.includes(s.id));
        const aiResult = await pickWinnerWithAI(curated.length ? curated : room.submissions, room.jokePrompt, room.category);
        winnerId = aiResult.winnerId;
        aiCommentary = aiResult.aiCommentary;
        judgingMethod = aiResult.judgingMethod;
    }

    if (!winnerId || !room.submissions.find(s => s.id === winnerId)) {
        winnerId = room.submissions[0]?.id;
        judgingMethod = 'coin_flip';
    }

    const result = await createRoundResult(room, winnerId, Date.now(), judgingMethod, false, aiCommentary, null, setRoom);

    const lastResult = room.roundResults[room.roundResults.length - 1];
    if (lastResult) {
        lastResult.voteCounts = voteCounts;
        lastResult.totalVotes = Object.keys(votes).length;
        await setRoom(room.id, room);
    }

    return room;
}

export async function createRoundResult(room, winnerId, now, judgingMethod = 'unknown', onChain = false, aiCommentary = null, txHash = null, setRoom = null, glOverride = false) {
    const winningSubmission = room.submissions.find(s => s.id === winnerId);

    if (!winningSubmission) {
        const fallback = room.submissions[0];
        if (!fallback) {
            room.status = 'roundResults';
            room.roundResults = room.roundResults || [];
            room.roundResults.push({ round: room.currentRound, winnerId: null, winnerName: 'No one', winningPunchline: 'No submissions', scores: {}, judgingMethod: 'skipped' });
            room.phaseEndsAt = null;
            if (setRoom) await setRoom(room.id, room);
            return room;
        }
        return createRoundResult(room, fallback.id, now, 'fallback', onChain, aiCommentary, txHash, setRoom, glOverride);
    }

    const roundResult = {
        round: room.currentRound,
        winnerId,
        winnerName: winningSubmission.playerName,
        winningPunchline: winningSubmission.punchline,
        judgingMethod,
        onChain,
        txHash,
        aiCommentary,
        glOverride,
        scores: {}
    };

    const authorPlayer = room.players.find(p => p.name === winningSubmission.playerName);
    if (authorPlayer) {
        authorPlayer.score += 100;
        roundResult.scores[authorPlayer.name] = 100;
    }

    room.bets.forEach(bet => {
        if (bet.submissionId === winnerId) {
            const betPlayer = room.players.find(p => p.name === bet.playerName);
            if (betPlayer) {
                betPlayer.score += bet.amount * 2;
                roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + bet.amount * 2;
            }
        }
    });

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

    const otherIds = room.submissions.map(s => s.id).filter(id => id !== winnerId);
    const shuffled = otherIds.sort(() => Math.random() - 0.5);
    roundResult.revealOrder = [...shuffled, winnerId];

    if (!room.streaks) room.streaks = {};
    for (const p of room.players) {
        if (!room.streaks[p.name]) room.streaks[p.name] = 0;
    }
    room.streaks[winningSubmission.playerName] = (room.streaks[winningSubmission.playerName] || 0) + 1;
    for (const p of room.players) {
        if (p.name !== winningSubmission.playerName) room.streaks[p.name] = 0;
    }
    roundResult.streak = room.streaks[winningSubmission.playerName];

    const sortedBefore = [...room.players].sort((a, b) =>
        (b.score - (roundResult.scores[b.name] || 0)) - (a.score - (roundResult.scores[a.name] || 0))
    );
    roundResult.isComeback = sortedBefore.length > 1 && sortedBefore[sortedBefore.length - 1]?.name === winningSubmission.playerName;

    room.roundResults.push(roundResult);
    room.status = 'roundResults';
    room.phaseEndsAt = null;
    room.updatedAt = now;
    room.lastJudgingMethod = judgingMethod;

    if (winningSubmission && !room.players.find(p => p.name === winningSubmission.playerName)?.isBot) {
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

    if (setRoom) await setRoom(room.id, room);
    return room;
}

// --- Bots ---

export async function addBotSubmissions(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.submissions.find(s => s.playerName === p.name));
    if (botsToAdd.length === 0) return;

    let dynamicPunchlines = await generateBotPunchlines(room.jokePrompt, room.category, botsToAdd.length);

    // Fill missing slots with fallback quips if AI returned fewer than needed
    if (dynamicPunchlines && dynamicPunchlines.length > 0) {
        while (dynamicPunchlines.length < botsToAdd.length) {
            dynamicPunchlines.push(BOT_FALLBACK_QUIPS[dynamicPunchlines.length % BOT_FALLBACK_QUIPS.length]);
        }
        botsToAdd.forEach((bot, i) => {
            room.submissions.push({
                id: room.submissions.length + 1,
                playerName: bot.name,
                punchline: dynamicPunchlines[i],
                submittedAt: Date.now()
            });
        });
        return;
    }

    const currentPrompt = room.jokePrompt;
    let availablePunchlines = PROMPT_PUNCHLINES[currentPrompt]
        ? [...PROMPT_PUNCHLINES[currentPrompt]]
        : null;

    if (!availablePunchlines) {
        const promptKey = Object.keys(PROMPT_PUNCHLINES).find(key =>
            currentPrompt.toLowerCase().includes(key.toLowerCase().slice(0, 30)) ||
            key.toLowerCase().includes(currentPrompt.toLowerCase().slice(0, 30))
        );
        if (promptKey) availablePunchlines = [...PROMPT_PUNCHLINES[promptKey]];
    }

    if (!availablePunchlines || availablePunchlines.length === 0) {
        availablePunchlines = [...(FALLBACK_PUNCHLINES[room.category] || FALLBACK_PUNCHLINES.general)];
    }

    botsToAdd.forEach(bot => {
        const unusedPunchlines = availablePunchlines.filter(p =>
            !room.submissions.find(s => s.punchline === p)
        );
        const punchlinePool = unusedPunchlines.length > 0 ? unusedPunchlines : availablePunchlines;
        const punchline = punchlinePool[Math.floor(Math.random() * punchlinePool.length)];
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

export function addBotBets(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.bets.find(b => b.playerName === p.name));

    botsToAdd.forEach(bot => {
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

// --- Prompts ---

export function getPromptsForCategory(category) {
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
    const theme = getCurrentTheme();
    const bonus = [...theme.bonusPrompts].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...base, ...bonus];
}

export async function getNextPrompt(room) {
    if (Math.random() < 0.3) {
        try {
            const communityPrompts = await redisGet('community_prompts') || [];
            const approved = communityPrompts.filter(p => p.status === 'approved' && !room.usedPrompts.includes(p.prompt));
            if (approved.length > 0) {
                const pick = approved[Math.floor(Math.random() * approved.length)];
                room.usedPrompts.push(pick.prompt);
                room.promptSource = { type: 'community', author: pick.author };
                return pick.prompt;
            }
        } catch (e) {
            console.log('[CommunityPrompts] Redis fetch failed, using hardcoded:', e.message);
        }
    }

    const prompts = getPromptsForCategory(room.category);
    const available = prompts.filter(p => !room.usedPrompts.includes(p));
    const prompt = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : prompts[Math.floor(Math.random() * prompts.length)];
    room.usedPrompts.push(prompt);
    room.promptSource = null;
    return prompt;
}
