// Oracle of Wit — Game Phase Renderers (ES Module)

import { state } from './state.js';
import { esc, glLogo, renderTimer } from './render-helpers.js';
import { startValidatorVoting } from './effects.js';

export function renderSubmitting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const submitted = r.submissions?.filter(s => !r.players.find(p => p.name === s.playerName)?.isBot).length || 0;
    const humanPlayers = r.players.filter(p => !p.isBot).length;

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-wit text-xs font-bold tracking-wider">ROUND ${r.currentRound}/${r.totalRounds}</span>
                    ${r.weeklyTheme ? `<span class="text-[9px] font-mono text-consensus/60 bg-consensus/10 px-1.5 py-0.5 rounded border border-consensus/20">${esc(r.weeklyTheme.emoji)} ${esc(r.weeklyTheme.name)}</span>` : ''}
                </div>
                <span data-hud="submitted" class="text-[10px] font-mono text-gray-500 tracking-wider">${submitted}/${humanPlayers} SUBMITTED</span>
            </div>
            <div class="glow-card p-5" style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(45,212,191,0.04),rgba(10,10,18,0.95))">
                <p class="text-[10px] font-mono text-oracle/60 tracking-widest mb-2">COMPLETE THIS JOKE</p>
                <p class="text-xl font-display font-medium">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-2 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            ${!state.hasSubmitted ? `
                <div class="glow-card p-4">
                    <textarea id="punchline" maxlength="200" placeholder="Write your funniest punchline..."
                        data-action-input="punchlineInput"
                        data-action-focus="punchlineFocus"
                        data-action-keydown="punchlineKeydown"
                        data-action-keyup="punchlineKeyup"
                        class="w-full h-28 px-4 py-3 rounded-xl text-lg resize-none">${state.punchlineText}</textarea>
                    <p class="text-[9px] font-mono text-gray-600/50 mt-1 tracking-wider">CTRL+ENTER TO SUBMIT</p>
                    <div class="flex justify-between items-center mt-3">
                        <span id="char-count" class="text-[10px] font-mono text-gray-600 tracking-wider">${state.punchlineText.length}/200</span>
                        <button data-action="submitPunchline" data-hover-sound="true" class="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-white text-xs">SUBMIT</button>
                    </div>
                </div>
            ` : `
                <div class="glow-card glow-card-green p-6 text-center">
                    <div class="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                        <span class="text-green-400 font-mono text-2xl">OK</span>
                    </div>
                    <p class="text-green-400 font-display font-bold text-lg tracking-wider">SUBMITTED</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">AWAITING TIMER EXPIRY</p>
                </div>
            `}
            ${state.isHost && r.submissions.length >= 1 ? `
                <button data-action="advancePhase" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO BETTING</button>
            ` : ''}
        </div>
    `;
}


export function renderCurating() {
    const r = state.room;
    if (!r) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const total = r.submissions?.length || 0;

    return `
        <div class="space-y-6">
            <div class="glow-card p-6 text-center" style="border-radius:20px">
                <div class="w-20 h-20 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 animate-glow processing">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>
                </div>
                <p class="text-[10px] font-mono text-oracle/60 tracking-[0.3em] mb-2">PROCESSING</p>
                <h2 class="text-2xl font-display font-bold mb-2 tracking-wider">ORACLE CURATING</h2>
                <p class="text-wit text-xs font-mono mb-4 tracking-wider">${total} SUBMISSIONS — SELECTING TOP 8</p>
                <div class="glass-bright rounded-xl p-4">
                    <div class="flex items-center justify-center gap-3">
                        <div class="spinner"></div>
                        <span class="text-gray-400 text-xs font-mono tracking-wider">ANALYZING HUMOR, ORIGINALITY, TIMING</span>
                    </div>
                    <div class="mt-3 h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                        <div class="h-full bg-gradient-to-r from-wit to-oracle rounded-full animate-pulse" style="width:75%"></div>
                    </div>
                </div>
                <p class="text-[10px] font-mono text-gray-600 mt-3 tracking-wider">LARGE ROOM — AUDIENCE VOTES ON FINALISTS</p>
            </div>
        </div>
    `;
}

export function renderVoting() {
    const r = state.room;
    if (!r) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';

    const curatedIds = r.curatedIds || [];
    const curated = r.submissions?.filter(s => curatedIds.includes(s.id)) || [];
    const totalVotes = Object.keys(r.audienceVotes || {}).length;
    const humanPlayers = r.players?.filter(p => !p.isBot).length || 1;
    const hasVoted = !!(r.audienceVotes?.[state.playerName]);

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-oracle text-xs font-bold tracking-wider">ROUND ${r.currentRound} — VOTE</span>
                    <span class="text-[9px] font-mono text-oracle/60 bg-oracle/10 px-1.5 py-0.5 rounded border border-oracle/20">TOP ${curated.length}</span>
                </div>
                <span class="text-[10px] font-mono text-gray-500 tracking-wider">${totalVotes}/${humanPlayers} VOTED</span>
            </div>
            <div class="glow-card p-2.5">
                <p class="text-sm text-gray-400 truncate">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-1 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            <p class="text-center text-sm font-display font-bold tracking-wider">VOTE FOR THE FUNNIEST</p>
            <div class="space-y-3">
                ${curated.map(s => `
                    <div ${hasVoted ? '' : `data-action="castVote" data-submission-id="${s.id}"`} class="glow-card p-4 ${hasVoted ? 'opacity-70' : 'cursor-pointer hover:bg-white/[0.03]'} ${state.votedFor === s.id ? 'card-selected' : ''}">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm ${state.votedFor === s.id ? 'bg-oracle text-void' : 'bg-obsidian border border-white/[0.06]'}">${s.id}</div>
                            <p class="flex-1 text-sm">${esc(s.punchline)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${hasVoted ? `
                <div class="glow-card glow-card-green p-6 text-center">
                    <div class="w-14 h-14 rounded-full bg-oracle/10 border border-oracle/30 flex items-center justify-center mx-auto mb-2">
                        <span class="text-oracle font-mono text-xl">OK</span>
                    </div>
                    <p class="text-oracle font-display font-bold text-lg tracking-wider">VOTE CAST</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">AWAITING OTHER PLAYERS</p>
                </div>
            ` : `
                <p class="text-center text-[10px] font-mono text-gray-600 tracking-wider">TAP A PUNCHLINE TO VOTE — CANNOT VOTE FOR YOUR OWN</p>
            `}
            ${state.isHost ? `
                <button data-action="advancePhase" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO RESULTS</button>
            ` : ''}
        </div>
    `;
}

export function renderBetting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const humanBets = r.bets?.filter(b => !r.players.find(p => p.name === b.playerName)?.isBot).length || 0;
    const humanPlayers = r.players.filter(p => !p.isBot).length;

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-consensus text-xs font-bold tracking-wider">ROUND ${r.currentRound} — BETTING</span>
                    ${r.weeklyTheme ? `<span class="text-[9px] font-mono text-consensus/60 bg-consensus/10 px-1.5 py-0.5 rounded border border-consensus/20">${esc(r.weeklyTheme.emoji)} ${esc(r.weeklyTheme.name)}</span>` : ''}
                </div>
                <span data-hud="bets" class="text-[10px] font-mono text-gray-500 tracking-wider">${humanBets}/${humanPlayers} BET</span>
            </div>
            <div class="glow-card p-2.5">
                <p class="text-sm text-gray-400 truncate">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-1 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            <p class="text-center text-sm font-display font-bold tracking-wider">PREDICT THE ORACLE'S PICK</p>
            <p class="text-center text-[10px] font-mono text-red-400/80 tracking-wider">WRONG PREDICTIONS COST YOUR BET</p>
            <div class="space-y-3">
                ${r.submissions.map(s => {
                    const rxForThis = (r.reactions||[]).filter(rx => rx.submissionId === s.id);
                    const emojiCounts = {};
                    rxForThis.forEach(rx => { emojiCounts[rx.emoji] = (emojiCounts[rx.emoji]||0) + 1; });
                    return `
                    <div class="relative">
                        <div data-action="selectSubmission" data-submission-id="${s.id}" class="glow-card p-4 cursor-pointer hover:bg-white/[0.03] ${state.selectedSubmission===s.id?'card-selected':''}">
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm ${state.selectedSubmission===s.id?'bg-wit text-void':'bg-obsidian border border-white/[0.06]'}">${s.id}</div>
                                <p class="flex-1 text-sm">${esc(s.punchline)}</p>
                            </div>
                            ${Object.keys(emojiCounts).length > 0 ? `
                                <div class="flex gap-1 mt-2 ml-12">${Object.entries(emojiCounts).map(([e,c]) => `<span class="text-xs bg-obsidian px-1.5 py-0.5 rounded-full border border-white/[0.04]">${e}${c>1?' x'+c:''}</span>`).join('')}</div>
                            ` : ''}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1 justify-end">
                            ${['\uD83D\uDE02','\uD83D\uDD25','\uD83D\uDC80','\uD83D\uDE10','\uD83D\uDC4F','\uD83E\uDD2E'].map(e => `
                                <button data-action="sendReaction" data-submission-id="${s.id}" data-emoji="${e}" class="text-base sm:text-lg hover:scale-125 transition-transform ${state.sentReactions >= 3 ? 'opacity-30 pointer-events-none' : ''}" title="React">${e}</button>
                            `).join('')}
                        </div>
                    </div>
                `}).join('')}
            </div>
            ${(() => {
                const budget = r.betBudgets?.[state.playerName] ?? 300;
                const sliderMax = Math.min(100, budget);
                const displayBetAmount = Math.min(state.betAmount, sliderMax);
                if (state.hasBet) return `
                    <div class="glow-card glow-card-green p-6 text-center">
                        <div class="w-14 h-14 rounded-full bg-consensus/10 border border-consensus/30 flex items-center justify-center mx-auto mb-3">
                            <span class="text-consensus font-mono text-xl">OK</span>
                        </div>
                        <p class="text-consensus font-display font-bold text-lg tracking-wider">BET PLACED</p>
                        <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">BUDGET: <span class="text-consensus font-bold">${budget} XP</span></p>
                    </div>`;
                if (budget <= 0) return `
                    <div class="glow-card p-6 text-center">
                        <p class="text-gray-500 font-display font-bold tracking-wider">NO BETS REMAINING</p>
                        <p class="text-[10px] font-mono text-gray-600 mt-1 tracking-wider">BUDGET DEPLETED — OBSERVING</p>
                    </div>`;
                return `
                    <div class="glow-card p-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] font-mono text-gray-600 tracking-widest">GAME BUDGET</span>
                            <span class="text-sm font-mono font-bold ${budget <= 50 ? 'text-red-400' : 'text-consensus'}">${budget} XP</span>
                        </div>
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-[10px] font-mono text-gray-500 tracking-wider">BET</span>
                            <input type="range" min="10" max="${sliderMax}" step="10" value="${displayBetAmount}" data-action-input="betSlider" class="flex-1">
                            <span id="bet-amount-display" class="text-xl font-mono font-bold text-consensus">${displayBetAmount}</span>
                        </div>
                        <button id="bet-submit-btn" data-action="placeBet" ${!state.selectedSubmission?'disabled':''} class="btn btn-play w-full py-3 rounded-xl font-bold text-sm">BET ON #${state.selectedSubmission||'?'}</button>
                    </div>`;
            })()}
            ${state.isHost && r.bets.length >= 1 ? `
                <button data-action="advancePhase" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO JUDGING</button>
            ` : ''}
        </div>
    `;
}

export function renderJudging() {
    // Start the validator voting animation if not already started
    if (!state.validatorVotingStarted) {
        state.validatorVotingStarted = true;
        state.validatorVotes = [];
        state.consensusReached = false;
        startValidatorVoting();
    }

    const validators = [
        { name: 'GPT-4', icon: '\uD83E\uDD16', color: 'bg-green-500', taste: 'Loves clever wordplay', thoughts: ['Analyzing wordplay...', 'Checking pun quality...', 'Rating timing...'] },
        { name: 'Claude', icon: '\uD83E\uDDE0', color: 'bg-purple-500', taste: 'Appreciates dark irony', thoughts: ['Evaluating irony...', 'Detecting layers...', 'Judging subtlety...'] },
        { name: 'LLaMA', icon: '\uD83E\uDD99', color: 'bg-blue-500', taste: 'Enjoys absurdist humor', thoughts: ['How absurd is this?', 'Rating chaos...', 'Measuring weird...'] },
        { name: 'Gemini', icon: '\uD83D\uDCAB', color: 'bg-yellow-500', taste: 'Values surprise twists', thoughts: ['Checking twists...', 'Rating shock value...', 'Surprise factor...'] },
        { name: 'Mixtral', icon: '\uD83D\uDD2E', color: 'bg-pink-500', taste: 'Loves cultural references', thoughts: ['Scanning refs...', 'Rating cultural IQ...', 'Checking depth...'] }
    ];

    const votedCount = state.validatorVotes?.length || 0;
    const consensusReached = state.consensusReached || false;

    const voteDist = {};
    (state.validatorVotes || []).forEach(v => { voteDist[v] = (voteDist[v] || 0) + 1; });
    const maxVotes = Math.max(...Object.values(voteDist), 1);
    const submissions = state.room?.submissions || [];

    return `
        <div class="glow-card p-6 text-center" style="border-radius:20px">
            <div class="w-24 h-24 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 ${consensusReached ? '' : 'animate-glow processing'}">
                <span class="text-4xl" style="filter:brightness(1.5)">${consensusReached ? '\u2728' : ''}</span>${!consensusReached ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>' : ''}
            </div>
            <p class="text-[10px] font-mono text-oracle/60 tracking-[0.3em] mb-1">${consensusReached ? 'FINALIZED' : 'PROCESSING'}</p>
            <h2 class="text-2xl font-display font-bold mb-2 tracking-wider">${consensusReached ? 'CONSENSUS REACHED' : 'ORACLE JUDGING'}</h2>
            <p class="text-wit text-xs font-mono mb-1 tracking-wider flex items-center justify-center gap-1.5">${glLogo(14, 'rgb(168,85,247)')} GENLAYER OPTIMISTIC DEMOCRACY</p>
            <p class="text-[10px] font-mono text-gray-600 mb-4 tracking-wider">INDEPENDENT VALIDATORS EVALUATE — CONSENSUS ON-CHAIN</p>

            <div class="glass-bright rounded-xl p-4 mb-4">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-mono text-gray-500 tracking-widest">VALIDATORS</span>
                    <span class="text-xs font-mono font-bold ${votedCount >= 3 ? 'text-green-400' : 'text-consensus'}">${votedCount}/5</span>
                </div>

                <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                    ${validators.map((v, i) => {
                        const hasVoted = i < votedCount;
                        const isThinking = i === votedCount && !consensusReached;
                        const vote = state.validatorVotes?.[i];
                        const thought = v.thoughts[Math.floor(Math.random() * v.thoughts.length)];
                        return `
                            <div class="flex flex-col items-center relative">
                                ${isThinking ? `
                                    <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-obsidian px-2 py-0.5 rounded-full text-[9px] text-gray-300 whitespace-nowrap animate-pulse border border-white/[0.06]">
                                        ${thought}
                                    </div>
                                ` : ''}
                                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full ${hasVoted ? v.color : 'bg-obsidian border border-white/[0.06]'} flex items-center justify-center text-lg sm:text-xl mb-1 transition-all duration-500 ${hasVoted ? 'scale-110 shadow-lg' : isThinking ? 'animate-glow' : 'opacity-50'}">
                                    ${hasVoted ? '\u2713' : v.icon}
                                </div>
                                <span class="text-[9px] sm:text-[10px] font-mono ${hasVoted ? 'text-white' : 'text-gray-600'}">${v.name}</span>
                                <span class="text-[9px] text-gray-700 hidden sm:block">${v.taste}</span>
                                ${hasVoted && vote ? `<span class="text-[10px] font-mono text-consensus">#${vote}</span>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                    <div class="h-full transition-all duration-500 rounded-full ${votedCount >= 3 ? 'bg-green-500' : 'bg-wit'}"
                         style="width: ${(votedCount / 5) * 100}%"></div>
                </div>
                <p class="text-[10px] font-mono mt-2 tracking-wider ${votedCount >= 3 ? 'text-green-400' : 'text-gray-500'}">
                    ${votedCount >= 3 ? 'MAJORITY CONSENSUS ACHIEVED' : 'AWAITING MAJORITY (3/5)'}
                </p>
            </div>

            ${votedCount > 0 ? `
            <div class="glass-bright rounded-xl p-3 mb-4">
                <p class="text-[10px] font-mono text-gray-600 mb-2 text-left tracking-widest">VOTE DISTRIBUTION</p>
                <div class="space-y-1.5">
                    ${submissions.map((s, idx) => {
                        const sid = s.id || (idx + 1);
                        const count = voteDist[sid] || 0;
                        const pct = votedCount > 0 ? (count / votedCount) * 100 : 0;
                        const isLeading = count === maxVotes && count > 0;
                        return `
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-mono text-gray-500 w-6 text-right">#${sid}</span>
                                <div class="flex-1 h-3 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                                    <div class="h-full rounded-full transition-all duration-700 ${isLeading ? 'bg-gradient-to-r from-consensus to-consensus-dim' : 'bg-wit/40'}" style="width:${pct}%"></div>
                                </div>
                                <span class="text-[10px] font-mono ${isLeading ? 'text-consensus font-bold' : 'text-gray-600'} w-6">${count}v</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <div class="glass-bright rounded-xl p-3 text-left max-h-32 overflow-y-auto">
                <p class="text-[10px] font-mono text-gray-600 mb-2 tracking-widest">LIVE VALIDATOR FEED</p>
                <div id="validator-feed" class="space-y-1 text-xs font-mono">
                    ${state.validatorVotes?.map((vote, i) => `
                        <div class="flex items-center gap-2 text-gray-400 animate-fadeIn">
                            <span class="text-green-400">OK</span>
                            <span>${validators[i].name} \u2192 #${vote}</span>
                        </div>
                    `).join('') || '<div class="text-gray-600">Initializing validators...</div>'}
                    ${consensusReached ? `
                        <div class="flex items-center gap-2 text-green-400 font-bold mt-2 animate-fadeIn tracking-wider">
                            <span>TX</span>
                            <span>CONSENSUS — RECORDING ON-CHAIN</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${consensusReached ? `
            <div class="mt-4 glass-bright rounded-xl p-3 animate-scaleIn">
                <div class="flex items-center justify-center gap-3">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm bg-wit animate-pulse"></div>
                        <div class="w-6 h-0.5 bg-wit/50"></div>
                        <div class="w-3 h-3 rounded-sm bg-wit animate-pulse" style="animation-delay:0.2s"></div>
                        <div class="w-6 h-0.5 bg-green-500/50"></div>
                        <div class="w-3 h-3 rounded-sm bg-green-500 animate-pulse" style="animation-delay:0.4s"></div>
                    </div>
                </div>
                <p class="text-[10px] font-mono text-green-400 mt-1.5 text-center tracking-wider flex items-center justify-center gap-1">${glLogo(11, 'rgb(34,197,94)')} BLOCK CONFIRMED &middot; TX FINALIZED ON GENLAYER</p>
            </div>
            ` : `
            <div class="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-gray-600 tracking-wider">
                ${glLogo(12, 'rgb(34,197,94)')}
                <span>CONNECTED TO GENLAYER INTELLIGENT CONTRACTS</span>
            </div>
            `}
        </div>
    `;
}
