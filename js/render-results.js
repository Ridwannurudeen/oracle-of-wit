// Oracle of Wit — Results Screen Renderers
// Depends on: state.js, render-helpers.js
// Functions: renderRevealing(), renderRoundResults(), renderFinalResults()

function renderRevealing() {
    if (!state.room) return '';
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return '';

    const revealOrder = result.revealOrder || r.submissions.map(s => s.id);
    const totalJokes = revealOrder.length;
    const revealed = state.revealedJokes;
    const current = revealed[revealed.length - 1];
    const isShowingWinner = current?.isWinner;
    const commentary = result.aiCommentary;

    // Crowd reaction meter levels
    const meterLevels = ['Crickets', 'Chuckle', 'Laugh', 'ROFL'];
    const meterIndex = Math.min(revealed.length, meterLevels.length - 1);
    const meterPct = ((revealed.length) / totalJokes) * 100;

    // Aggregate reactions for current joke
    const reactions = r.reactions || [];
    const currentReactions = current ? reactions.filter(rx => rx.submissionId === current.id) : [];
    const emojiCounts = {};
    currentReactions.forEach(rx => { emojiCounts[rx.emoji] = (emojiCounts[rx.emoji] || 0) + 1; });

    return `
        <div class="space-y-4">
            <div class="glow-card p-3 flex justify-between items-center">
                <span class="font-mono text-wit text-xs font-bold tracking-wider">ROUND ${result.round} — REVEAL</span>
                <span class="text-[10px] font-mono text-gray-500 tracking-wider">${revealed.length}/${totalJokes} REVIEWED</span>
            </div>

            <div class="glow-card p-3 text-center">
                <p class="text-gray-400 text-sm">"${esc(r.jokePrompt)}"</p>
            </div>

            ${revealed.length === 0 ? `
                <div class="glow-card p-8 text-center animate-glow" style="border-radius:20px">
                    <div class="w-20 h-20 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 animate-float processing">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>
                    </div>
                    <p class="text-xl font-display font-bold gradient-text tracking-wider">ORACLE REVIEWING</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">PREPARING JUDGMENT</p>
                </div>
            ` : ''}

            ${current && !isShowingWinner ? `
                <div class="glow-card glow-card-red p-6 animate-slideIn">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-red-400 font-mono text-xs font-bold tracking-wider">ELIMINATED</span>
                        <span class="text-gray-600 text-[10px] font-mono">#${current.id}</span>
                    </div>
                    <p class="text-lg">"${esc(current.punchline)}"</p>
                    <p class="text-gray-500 text-xs font-mono mt-1">${esc(current.playerName)}</p>
                    ${commentary?.roasts?.[current.id] ? `
                        <p class="text-gray-400 text-sm mt-2 italic typewriter">${esc(commentary.roasts[current.id])}</p>
                    ` : ''}
                    ${Object.keys(emojiCounts).length > 0 ? `
                        <div class="flex gap-2 mt-2">${Object.entries(emojiCounts).map(([e,c]) => `<span class="text-xs bg-obsidian px-2 py-1 rounded-full border border-white/[0.04]">${e} x${c}</span>`).join('')}</div>
                    ` : ''}
                </div>
            ` : ''}

            ${isShowingWinner ? `
                <div class="glow-card glow-card-gold p-8 text-center animate-winnerScale animate-goldPulse">
                    <p class="text-[10px] font-mono text-consensus/60 tracking-[0.3em] mb-2">WINNER</p>
                    <p class="text-consensus font-display font-bold text-xl mb-2 tracking-wider">THE ORACLE HAS SPOKEN</p>
                    <p class="text-2xl font-display font-bold my-3">"${esc(current.punchline)}"</p>
                    <p class="text-gray-400 text-sm font-mono">${esc(current.playerName)}</p>
                    ${commentary?.winnerComment ? `
                        <p class="text-consensus/80 text-sm mt-3 italic">${esc(commentary.winnerComment)}</p>
                    ` : ''}
                    ${result.streak >= 2 ? `
                        <div class="mt-3 streak-fire text-sm font-mono font-bold text-orange-400 tracking-wider">${'\uD83D\uDD25'.repeat(Math.min(result.streak, 5))} ${result.streak}-WIN STREAK</div>
                    ` : ''}
                    ${result.isComeback ? `
                        <div class="mt-2 animate-comeback text-sm font-mono font-bold text-oracle tracking-wider">COMEBACK</div>
                    ` : ''}
                </div>
            ` : ''}

            ${revealed.length > 0 ? `
                <div class="glow-card p-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-mono text-gray-600 tracking-widest">CROWD REACTION</span>
                        <span class="text-xs font-mono font-bold ${meterIndex >= 2 ? 'text-green-400' : 'text-gray-500'}">${meterLevels[meterIndex]}</span>
                    </div>
                    <div class="h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                        <div class="h-full rounded-full bg-gradient-to-r from-consensus to-red-500 meter-fill" style="--fill-pct: ${meterPct}%"></div>
                    </div>
                </div>
            ` : ''}

            ${revealed.filter(j => j.eliminated && j !== current).length > 0 ? `
                <div class="space-y-1">
                    ${revealed.filter(j => j.eliminated && j !== current).map(j => `
                        <div class="bg-obsidian/50 rounded-xl p-2 opacity-40 border border-white/[0.02]">
                            <div class="flex items-center gap-2">
                                <span class="text-red-400 text-[10px] font-mono">X</span>
                                <span class="text-[10px] font-mono text-gray-600 truncate">"${esc(j.punchline)}" — ${esc(j.playerName)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <button data-action="skipReveal" class="btn btn-ghost w-full py-2 rounded-xl text-xs text-gray-500">
                SKIP REVEAL
            </button>
        </div>
    `;
}

function renderRoundResults() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return renderJudging();

    // Determine judging method badge and info
    const judgingMethod = result.judgingMethod || r.lastJudgingMethod || 'ai';
    const isOnChain = judgingMethod === 'genlayer_optimistic_democracy';
    const isAI = judgingMethod === 'claude_api';
    const isAudienceVote = judgingMethod === 'audience_vote' || judgingMethod === 'audience_vote_ai_tiebreak';

    const txHashRaw = result.txHash || null;
    const txHash = txHashRaw && /^0x[0-9a-fA-F]+$/.test(txHashRaw) ? txHashRaw : null;
    const explorerUrl = txHash ? `https://explorer-bradbury.genlayer.com/transactions/${txHash}` : null;

    const isCoinFlip = judgingMethod === 'coin_flip';
    const methodBadge = isOnChain
        ? `<span class="text-xs bg-green-600 px-2 py-1 rounded-full font-medium">\u26D3\uFE0F On-Chain Verified (Bradbury Testnet)</span>${txHash ? `<a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="block text-[10px] text-green-400/70 mt-1 hover:underline">tx: ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 6)}</a>` : ''}`
        : isAudienceVote
        ? `<span class="text-xs bg-cyan-600 px-2 py-1 rounded-full font-medium">\uD83D\uDDF3\uFE0F Audience Vote${result.totalVotes ? ` (${result.totalVotes} votes)` : ''}${judgingMethod === 'audience_vote_ai_tiebreak' ? ' + AI Tiebreak' : ''}</span>`
        : isAI
        ? '<span class="text-xs bg-purple-600 px-2 py-1 rounded-full font-medium">\uD83E\uDD16 AI Judged</span>'
        : isCoinFlip
        ? '<span class="text-xs bg-amber-600 px-2 py-1 rounded-full font-medium">\uD83C\uDFB2 Oracle Coin Flip \u2014 couldn\'t decide!</span>'
        : '<span class="text-xs bg-gray-600 px-2 py-1 rounded-full font-medium">\uD83C\uDFB2 Fallback</span>';

    // Get winner ID
    const winnerId = result.winnerId;

    // Generate validator votes if not already generated
    if (!state.validatorVotes || state.validatorVotes.length === 0) {
        const submissions = r.submissions || [];
        const otherIds = submissions.map(s => s.id).filter(id => id !== winnerId);
        state.validatorVotes = [];
        for (let i = 0; i < 5; i++) {
            if (i < 4 || Math.random() > 0.5) {
                state.validatorVotes.push(winnerId);
            } else if (otherIds.length > 0) {
                state.validatorVotes.push(otherIds[Math.floor(Math.random() * otherIds.length)]);
            } else {
                state.validatorVotes.push(winnerId);
            }
        }
    }

    const validatorVotes = state.validatorVotes;
    const validators = ['GPT-4', 'Claude', 'LLaMA', 'Gemini', 'Mixtral'];
    const agreedCount = validatorVotes.filter(v => v === winnerId).length;

    return `
        <div class="space-y-4">
            <!-- Winner Card -->
            <div class="glow-card glow-card-gold p-6 text-center">
                <p class="text-[10px] font-mono text-consensus/60 tracking-[0.3em] mb-2">ROUND ${result.round} WINNER</p>
                <p class="text-xl font-display font-bold my-2">"${esc(result.winningPunchline)}"</p>
                <p class="text-gray-400 text-sm font-mono">${esc(result.winnerName)}</p>
                <p class="text-green-400 mt-1 font-mono text-sm font-bold">+100 XP</p>
                <div class="mt-2">${methodBadge}</div>
            </div>

            <!-- Optimistic Democracy Summary -->
            <div class="glow-card glow-card-green p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-mono font-bold text-wit tracking-wider">OPTIMISTIC DEMOCRACY</span>
                    <span class="text-[10px] font-mono text-green-400 tracking-wider">CONSENSUS</span>
                </div>
                <div class="flex justify-center gap-3 mb-3">
                    ${validators.map((v, i) => {
                        const vote = validatorVotes[i];
                        const agreed = vote === winnerId;
                        return `
                            <div class="flex flex-col items-center">
                                <div class="w-10 h-10 rounded-full ${agreed ? 'bg-green-500' : 'bg-orange-500'} flex items-center justify-center text-sm font-mono font-bold shadow-lg">
                                    ${agreed ? 'OK' : 'X'}
                                </div>
                                <span class="text-[10px] font-mono text-gray-500 mt-1">${v.split('-')[0]}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p class="text-[10px] font-mono text-center text-green-400 tracking-wider">
                    ${agreedCount}/5 VALIDATORS AGREED
                </p>
            </div>

            ${result.aiCommentary?.winnerComment ? `
                <div class="glow-card glow-card-amber p-4">
                    <p class="text-[10px] font-mono text-gray-600 mb-1 tracking-widest">ORACLE COMMENTARY</p>
                    <p class="text-consensus/80 italic text-sm">"${esc(result.aiCommentary.winnerComment)}"</p>
                </div>
            ` : ''}

            ${result.isComeback ? `
                <div class="glow-card glow-card-cyan p-4 text-center animate-comeback">
                    <span class="text-lg font-display font-bold text-oracle tracking-wider">COMEBACK</span>
                    <p class="text-xs font-mono text-gray-500 mt-1">${esc(result.winnerName)} from last place</p>
                </div>
            ` : ''}
            ${result.streak >= 2 ? `
                <div class="glow-card glow-card-amber p-3 text-center ${result.streak >= 3 ? 'animate-screenShake' : ''}">
                    <span class="text-sm font-mono font-bold streak-fire text-orange-400 tracking-wider">
                        ${'\uD83D\uDD25'.repeat(Math.min(result.streak, 5))} ${result.streak >= 3 ? 'UNSTOPPABLE' : result.streak + '-WIN STREAK'}
                    </span>
                </div>
            ` : ''}

            <!-- Standings -->
            <div class="glow-card p-4">
                <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-3">STANDINGS</p>
                <div class="space-y-2">
                    ${[...r.players].sort((a,b)=>b.score-a.score).map((p,i) => {
                        const change = result.scores?.[p.name] || 0;
                        const streakCount = r.streaks?.[p.name] || 0;
                        return `
                        <div class="flex justify-between items-center p-2.5 ${p.name===state.playerName?'bg-wit/10 border border-wit/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-mono">${i===0?'\uD83E\uDD47':i===1?'\uD83E\uDD48':i===2?'\uD83E\uDD49':'#'+(i+1)}</span>
                                <span class="text-sm">${esc(p.name)}</span>
                                ${p.isBot?'<span class="text-[9px] font-mono text-oracle/60 bg-oracle/10 px-1 py-0.5 rounded">BOT</span>':''}
                                ${streakCount >= 2 ? '<span class="text-xs">' + '\uD83D\uDD25'.repeat(Math.min(streakCount, 3)) + '</span>' : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                ${change > 0 ? `<span class="text-green-400 text-[10px] font-mono font-bold">+${change}</span>` : change < 0 ? `<span class="text-red-400 text-[10px] font-mono font-bold">${change}</span>` : ''}
                                <span class="text-consensus font-mono font-bold text-sm">${p.score}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>

            <!-- Appeal Mechanic -->
            ${!result.appealed && !state.appealInProgress ? `
                <button data-action="appealVerdict" class="btn w-full py-3 rounded-xl font-bold text-white text-xs" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);box-shadow:0 4px 20px rgba(185,28,28,0.3)">
                    APPEAL VERDICT (50 XP) \u2014 CHALLENGE THE ORACLE
                </button>
            ` : ''}
            ${state.appealInProgress ? `
                <div class="glow-card glow-card-red p-6 text-center animate-glow">
                    <div class="w-16 h-16 oracle-eye rounded-full flex items-center justify-center mx-auto mb-3 animate-float">
                        <span class="text-2xl">\u2696</span>
                    </div>
                    <p class="text-lg font-display font-bold text-red-400 tracking-wider">RE-EVALUATING</p>
                    <p class="text-xs font-mono text-gray-500 mt-1 tracking-wider">10 VALIDATORS \u2014 EXTRA SCRUTINY</p>
                    <div class="spinner mx-auto mt-3"></div>
                </div>
            ` : ''}
            ${state.appealResult ? `
                <div class="glow-card ${state.appealResult.overturned ? 'glow-card-green' : 'glow-card-red'} p-6 text-center">
                    <p class="text-lg font-display font-bold tracking-wider ${state.appealResult.overturned ? 'text-green-400' : 'text-red-400'}">
                        ${state.appealResult.overturned ? 'OVERTURNED' : 'UPHELD'}
                    </p>
                    <p class="text-xs font-mono text-gray-500 mt-1">${state.appealResult.overturned ? '50 XP refunded' : '50 XP lost'}</p>
                    ${state.appealResult.onChain ? `
                        <p class="text-[10px] font-mono text-green-400/70 mt-2 tracking-wider">VERIFIED ON GENLAYER BRADBURY TESTNET</p>
                        ${state.appealResult.txHash && /^0x[0-9a-fA-F]+$/.test(state.appealResult.txHash) ? `<a href="https://explorer-bradbury.genlayer.com/transactions/${state.appealResult.txHash}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-mono text-green-400/50 hover:underline">tx: ${state.appealResult.txHash.substring(0, 10)}...</a>` : ''}
                    ` : ''}
                </div>
            ` : ''}
            ${result.appealed && !state.appealResult ? `
                <div class="glow-card p-3 text-center">
                    <p class="text-xs font-mono text-gray-500 tracking-wider">${result.appealResult === 'overturned' ? 'VERDICT OVERTURNED BY APPEAL' : 'APPEAL UPHELD \u2014 ORACLE STANDS'}</p>
                </div>
            ` : ''}

            <div class="flex gap-2">
                <button id="challenge-btn" data-action="createChallengeLink" class="btn btn-ghost flex-1 py-2.5 rounded-xl text-xs text-oracle">CHALLENGE</button>
                <button data-action="shareRoundResult" class="btn btn-primary flex-1 py-2.5 rounded-xl text-xs text-white">SHARE</button>
            </div>

            ${state.isHost ? `
                <button data-action="nextRound" data-hover-sound="true" class="btn btn-play w-full py-4 rounded-xl font-bold text-sm">
                    ${r.currentRound >= r.totalRounds ? 'FINAL RESULTS' : 'NEXT ROUND'}
                </button>
            ` : '<div class="text-center py-4 text-gray-500 font-mono text-xs tracking-wider"><div class="spinner mx-auto mb-2"></div>WAITING FOR HOST</div>'}
            <button data-action="leaveRoom" class="btn btn-ghost w-full py-2 rounded-xl text-xs text-gray-500 hover:text-white mt-1">&larr; LEAVE GAME</button>
        </div>
    `;
}

function renderFinalResults() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const standings = [...r.players].sort((a,b)=>b.score-a.score);
    const winner = standings[0];
    const playerRank = standings.findIndex(p=>p.name===state.playerName)+1;
    const isWinner = playerRank === 1;
    const playerScore = r.players.find(p=>p.name===state.playerName)?.score || 0;

    // Session stats
    let roundsWon = 0, correctBets = 0, totalXP = playerScore, bestJoke = null;
    for (const rr of (r.roundResults || [])) {
        if (rr.winnerName === state.playerName) {
            roundsWon++;
            if (!bestJoke) bestJoke = rr.winningPunchline;
        }
    }

    // Track games today (only increment once per game via flag)
    const todayKey = 'gamesToday_' + getTodayKeyClient();
    if (!state._gameCounted) {
        state._gameCounted = true;
        localStorage.setItem(todayKey, parseInt(localStorage.getItem(todayKey) || '0') + 1);
    }
    const gamesToday = parseInt(localStorage.getItem(todayKey) || '0');

    return `
        <div class="space-y-4">
            <div class="text-center py-6">
                <h2 class="text-3xl font-display font-bold tracking-wider"><span class="gradient-text">GAME COMPLETE</span></h2>
                <p class="text-[10px] font-mono tracking-widest text-gray-500 mt-1 uppercase">${r.totalRounds} rounds played</p>
            </div>
            <div class="glow-card glow-card-gold p-6 text-center">
                <p class="text-[10px] font-mono tracking-widest text-consensus uppercase">Winner</p>
                <p class="text-3xl font-display font-bold mt-1">${esc(winner.name)}</p>
                <p class="text-2xl text-consensus font-mono font-bold mt-1">${winner.score} XP</p>
                ${winner.isBot ? '<p class="text-gray-500 text-[10px] font-mono tracking-wider uppercase mt-1">Autonomous Agent</p>' : ''}
            </div>

            <!-- Session Recap -->
            <div class="glow-card p-4">
                <h3 class="font-display font-bold mb-3 text-center text-wit tracking-wider uppercase text-sm">Session Recap</h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.1s">
                        <p class="text-2xl font-mono font-bold text-consensus">${totalXP}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">XP EARNED</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.2s">
                        <p class="text-2xl font-mono font-bold text-green-400">${roundsWon}/${r.totalRounds}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">ROUNDS WON</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.3s">
                        <p class="text-2xl font-mono font-bold text-blue-400">#${playerRank}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">FINISH</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.4s">
                        <p class="text-2xl font-mono font-bold text-wit">${gamesToday}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">GAMES TODAY</p>
                    </div>
                </div>
                ${bestJoke ? `<p class="text-center text-sm text-gray-400 mt-3 italic">Best joke: "${esc(bestJoke)}"</p>` : ''}
            </div>

            <!-- Profile Update -->
            ${state.profile ? `
                <div class="glow-card p-4 bg-obsidian border border-white/[0.04]">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-10 h-10 oracle-eye rounded-full flex items-center justify-center font-mono font-bold text-sm">${state.profile.level}</div>
                        <div class="flex-1">
                            <p class="text-sm font-display font-bold">${esc(state.profile.title)}</p>
                            <div class="h-2.5 bg-obsidian rounded-full overflow-hidden mt-1 border border-white/[0.04]">
                                <div class="h-full xp-bar" style="width:${(() => { const lvlXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][state.profile.level] || 0; return state.nextLevelXP ? Math.min(100, ((state.profile.lifetimeXP - lvlXP) / (state.nextLevelXP - lvlXP)) * 100) : 100; })()}%"></div>
                            </div>
                        </div>
                        <p class="text-consensus font-mono font-bold text-sm">${state.profile.lifetimeXP?.toLocaleString()} XP</p>
                    </div>
                </div>
            ` : ''}

            <div class="glow-card p-4">
                <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">Final Standings</h3>
                <div class="space-y-2">
                    ${standings.map((p,i) => `
                        <div class="flex justify-between items-center p-2.5 ${p.name===state.playerName?'bg-wit/10 border border-wit/20':i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-bold text-sm ${i===0?'text-consensus':i===1?'text-gray-300':i===2?'text-amber-700':'text-gray-500'}">${i<3?['I','II','III'][i]:'#'+(i+1)}</span>
                                <span class="font-display">${esc(p.name)}</span>
                                ${p.isBot?'<span class="text-[10px] font-mono tracking-wider bg-obsidian border border-white/[0.04] px-1.5 py-0.5 rounded-full text-gray-500">BOT</span>':''}
                                ${p.name===state.playerName?'<span class="text-[10px] font-mono tracking-wider bg-wit/20 border border-wit/30 px-1.5 py-0.5 rounded-full text-wit">YOU</span>':''}
                            </div>
                            <span class="text-consensus font-mono font-bold">${p.score} XP</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${isWinner && !winner.isBot ? '<p class="text-center font-display font-bold tracking-wider text-lg text-consensus">VICTORY</p>' : `<p class="text-center text-gray-500 font-mono text-xs tracking-wider uppercase">Finished #${playerRank}</p>`}

            <!-- Share Buttons -->
            <div class="grid grid-cols-3 gap-2">
                <button id="copy-share-btn" data-action="copyShareText" data-player-score="${playerScore}" data-rounds-won="${roundsWon}" data-total-rounds="${r.totalRounds}" class="btn btn-ghost py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider">Copy</button>
                <button data-action="shareFinalResult" class="btn btn-primary py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white">Share</button>
                <button data-action="tweetResult" data-player-score="${playerScore}" data-rounds-won="${roundsWon}" data-total-rounds="${r.totalRounds}" class="btn py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white" style="background:linear-gradient(135deg,#0284c7,#0369a1);box-shadow:0 4px 15px rgba(2,132,199,0.3)">Tweet</button>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <button data-action="createRoom" data-category="${esc(r.category)}" data-single-player="${!!r.isSinglePlayer}" class="btn btn-play py-4 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white">Rematch</button>
                <button data-action="leaveRoom" class="btn btn-primary py-4 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white">Play Again</button>
            </div>
        </div>
    `;
}
