/**
 * @module render-screens
 * @description Secondary screen renderers: daily challenge, profile, hall of fame, community prompts.
 */

import { state } from './state.js';
import { esc } from './render-helpers.js';

/**
 * Render the daily challenge screen (prompt, submission form, or result).
 * @returns {string} HTML string.
 */
export function renderDailyChallenge() {
    const dc = state.dailyChallenge;
    if (!dc) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const dr = state.dailyResult;

    if (dc.alreadyPlayed && !dr) {
        return `
            <div class="space-y-4">
                <button data-action="backToLobby" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
                <div class="glow-card glow-card-amber p-8 text-center">
                    <h2 class="text-2xl font-display font-bold mb-2 tracking-wider uppercase">ALREADY COMPLETED</h2>
                    <p class="text-gray-400">Come back tomorrow for a new challenge.</p>
                    ${state.profile?.dailyChallengeStreak > 0 ? `<p class="text-consensus font-mono font-bold mt-3">${state.profile.dailyChallengeStreak}-day streak</p>` : ''}
                    <div class="mt-4 text-[10px] font-mono tracking-wider text-gray-500 uppercase" id="daily-countdown"></div>
                </div>
                ${dc.leaderboard.length > 0 ? `
                    <div class="glow-card p-4">
                        <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                        <div class="space-y-2">
                            ${dc.leaderboard.slice(0,10).map((e,i) => `
                                <div class="flex justify-between items-center p-2.5 ${i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                    <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                    <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>`;
    }

    if (dr) {
        return `
            <div class="space-y-4">
                <button data-action="backToLobbyFromDailyResult" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
                <div class="glow-card ${dr.won ? 'glow-card-gold' : ''} p-6 text-center">
                    <h2 class="text-2xl font-display font-bold mb-1 tracking-wider uppercase">${dr.won ? 'VICTORY' : 'DEFEATED'}</h2>
                    <p class="text-sm text-gray-400 mb-2">"${esc(dc.prompt)}"</p>
                    <p class="text-lg font-medium">"${esc(dr.winningPunchline)}"</p>
                    <p class="text-[10px] font-mono tracking-wider text-gray-400 uppercase mt-1">by ${esc(dr.winnerName)}</p>
                    ${dr.aiCommentary?.winnerComment ? `<p class="text-consensus/80 text-sm mt-2 italic">"${esc(dr.aiCommentary.winnerComment)}"</p>` : ''}
                    <p class="text-2xl font-display font-bold text-consensus mt-3">+<span class="font-mono">${dr.score}</span> XP</p>
                    ${dr.streak > 0 ? `<p class="text-consensus font-mono font-bold mt-1">${dr.streak}-day streak</p>` : ''}
                </div>
                ${dr.leaderboard?.length > 0 ? `
                    <div class="glow-card p-4">
                        <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                        <div class="space-y-2">
                            ${dr.leaderboard.slice(0,10).map((e,i) => `
                                <div class="flex justify-between items-center p-2.5 ${e.name===state.playerName?'bg-wit/10 border border-wit/20':i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                    <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                    <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <p class="text-center text-[10px] font-mono tracking-wider text-gray-500 uppercase">Next challenge tomorrow</p>
            </div>`;
    }

    return `
        <div class="space-y-4">
            <button data-action="backToLobbyFromDaily" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
            <div class="glow-card glow-card-amber p-6">
                <div class="text-center mb-4">
                    <h2 class="text-2xl font-display font-bold tracking-wider uppercase">DAILY ORACLE</h2>
                    <p class="text-[10px] font-mono tracking-wider text-gray-400 uppercase mt-1">${esc(dc.date)}</p>
                    ${state.profile?.dailyChallengeStreak > 0 ? `<p class="text-consensus font-mono font-bold mt-2">${state.profile.dailyChallengeStreak}-day streak</p>` : ''}
                </div>
                <div class="glow-card p-4 mb-4" style="background:linear-gradient(135deg,rgba(88,28,135,0.2),rgba(157,23,77,0.15),rgba(15,20,35,0.9))">
                    <p class="text-[10px] font-mono tracking-wider text-wit uppercase mb-1">Complete this joke</p>
                    <p class="text-lg font-medium">"${esc(dc.prompt)}"</p>
                </div>
                <textarea id="daily-punchline" maxlength="200" placeholder="Write your funniest punchline..."
                    data-action-keydown="dailyPunchlineKeydown"
                    class="w-full h-28 px-4 py-3 rounded-xl text-lg resize-none mb-2"></textarea>
                <p class="text-[9px] font-mono text-gray-600/50 mb-3 tracking-wider">CTRL+ENTER TO SUBMIT</p>
                <button data-action="submitDailyChallenge" ${state.dailySubmitting ? 'disabled' : ''} class="btn btn-play w-full py-4 rounded-xl font-bold text-sm tracking-wider uppercase text-white">
                    ${state.dailySubmitting ? '<span class="spinner inline-block w-5 h-5 mr-2 align-middle"></span>JUDGING...' : 'SUBMIT TO THE ORACLE'}
                </button>
            </div>
            ${dc.leaderboard.length > 0 ? `
                <div class="glow-card p-4">
                    <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                    <div class="space-y-2">
                        ${dc.leaderboard.slice(0,10).map((e,i) => `
                            <div class="flex justify-between items-center p-2.5 ${i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>`;
}

/**
 * Render the player profile screen with stats, level progress, and achievements.
 * @returns {string} HTML string.
 */
export function renderProfileScreen() {
    const p = state.profile;
    if (!p) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-circle mx-auto" style="width:80px;height:80px"></div><div class="skeleton skeleton-text mx-auto" style="width:40%"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:140px"></div></div>';
    const nextXP = state.nextLevelXP;
    const currentLevelXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][p.level] || 0;
    const progress = nextXP ? Math.min(100, ((p.lifetimeXP - currentLevelXP) / (nextXP - currentLevelXP)) * 100) : 100;
    const winRate = p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0;

    return `
        <div class="space-y-4">
            <button data-action="backToLobby" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
            <div class="glow-card p-6 text-center">
                <div class="w-20 h-20 rounded-full oracle-eye flex items-center justify-center mx-auto mb-3 text-3xl font-bold">${p.level}</div>
                <h2 class="text-2xl font-display font-bold">${esc(p.name)}</h2>
                <p class="text-wit font-mono font-medium">${esc(p.title)}</p>
                <p class="text-consensus font-mono text-xl font-bold mt-2">${p.lifetimeXP.toLocaleString()} XP</p>
                <div class="max-w-xs mx-auto mt-3">
                    <div class="flex justify-between text-[10px] font-mono tracking-wider text-gray-400 mb-1">
                        <span>Lv.${p.level}</span>
                        <span>${nextXP ? 'Lv.' + (p.level + 1) : 'MAX'}</span>
                    </div>
                    <div class="h-3 bg-obsidian border border-white/[0.04] rounded-full overflow-hidden">
                        <div class="h-full xp-bar" style="width:${progress}%"></div>
                    </div>
                    <p class="text-[10px] font-mono text-gray-500 mt-1">${nextXP ? (nextXP - p.lifetimeXP).toLocaleString() + ' XP to next level' : 'Maximum level reached!'}</p>
                </div>
            </div>

            <div class="glow-card p-4">
                <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Statistics</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-white">${p.gamesPlayed}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Games Played</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-green-400">${p.gamesWon}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Games Won</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-consensus">${p.roundsWon}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Rounds Won</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-wit">${winRate}%</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Win Rate</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-orange-400">${p.bestStreak}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Best Streak</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-blue-400">${p.totalCorrectBets}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Correct Bets</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center col-span-2">
                        <p class="text-xl font-bold text-amber-400">${p.dailyChallengeStreak}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Daily Challenge Streak</p>
                    </div>
                </div>
            </div>

            ${p.achievements.length > 0 ? `
                <div class="glow-card p-4">
                    <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Achievements (${p.achievements.length}/${state.allAchievements.length})</h3>
                    <div class="grid grid-cols-3 gap-2">
                        ${state.allAchievements.map(a => {
                            const unlocked = p.achievements.includes(a.id);
                            return `
                                <div class="rounded-xl p-2.5 text-center ${unlocked ? 'bg-consensus/10 border border-consensus/30' : 'bg-obsidian/80 border border-white/[0.04] opacity-40'}">
                                    <span class="text-2xl">${esc(a.icon)}</span>
                                    <p class="text-xs ${unlocked ? 'text-white' : 'text-gray-500'} mt-1">${esc(a.name)}</p>
                                </div>`;
                        }).join('')}
                    </div>
                </div>
            ` : `
                <div class="glow-card p-4">
                    <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Achievements</h3>
                    <div class="grid grid-cols-3 gap-2">
                        ${state.allAchievements.map(a => `
                            <div class="rounded-xl p-2.5 text-center bg-obsidian/80 border border-white/[0.04] opacity-40">
                                <span class="text-2xl">${esc(a.icon)}</span>
                                <p class="text-xs text-gray-500 mt-1">${esc(a.name)}</p>
                            </div>
                        `).join('')}
                    </div>
                    <p class="text-center text-gray-500 text-sm mt-3">Play games to unlock achievements!</p>
                </div>
            `}
        </div>`;
}

/**
 * Render the hall of fame screen with top winning jokes.
 * @returns {string} HTML string.
 */
export function renderHallOfFame() {
    return `
        <div class="space-y-4">
            <button data-action="backToLobbyFromHallOfFame" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-sm">&larr; Back to Lobby</button>
            <div class="text-center">
                <h2 class="text-2xl font-display font-bold tracking-wider"><span class="gradient-text">HALL OF FAME</span></h2>
                <p class="text-xs font-mono text-gray-500 tracking-wider">The Oracle's finest judgments</p>
            </div>
            ${state.hallOfFame.length > 0 ? `
                <div class="space-y-3">
                    ${state.hallOfFame.map((j, i) => `
                        <div class="glow-card ${i < 3 ? 'glow-card-gold' : ''} p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-lg shrink-0">${i===0?'\uD83E\uDD47':i===1?'\uD83E\uDD48':i===2?'\uD83E\uDD49':'#'+(i+1)}</span>
                                <div class="flex-1">
                                    <p class="text-sm text-gray-400">"${esc(j.prompt)}"</p>
                                    <p class="text-white font-medium mt-1">"${esc(j.punchline)}"</p>
                                    <div class="flex justify-between items-center mt-2">
                                        <span class="text-xs text-consensus">by ${esc(j.author)}</span>
                                        ${j.commentary ? `<span class="text-xs text-gray-500 italic">${esc(j.commentary)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-gray-500 text-center py-8">No winning jokes recorded yet. Play to be the first!</p>'}
        </div>`;
}

/**
 * Render the community prompts screen with submission form and voting list.
 * @returns {string} HTML string.
 */
export function renderCommunityPrompts() {
    return `
        <div class="space-y-4">
            <button data-action="backToLobbyFromCommunity" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 text-sm">&larr; Back to Lobby</button>
            <div class="text-center">
                <h2 class="text-2xl font-display font-bold tracking-wider"><span class="gradient-text">COMMUNITY PROMPTS</span></h2>
                <p class="text-xs font-mono text-gray-500 tracking-wider">Submit joke setups. Top-voted enter the game rotation!</p>
            </div>

            <!-- Submit form -->
            <div class="glow-card glow-card-cyan p-5">
                <h3 class="text-[10px] font-mono tracking-widest text-gray-400 mb-2">SUBMIT A JOKE SETUP</h3>
                <textarea id="community-prompt-input" rows="2" maxlength="150" placeholder="e.g. Why do blockchain developers..."
                    data-action-keydown="communityPromptKeydown"
                    class="w-full px-3 py-2 rounded-xl text-sm resize-none"></textarea>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs text-gray-500">10-150 characters</span>
                    <button data-action="submitCommunityPrompt" class="btn btn-primary px-4 py-1.5 rounded-lg text-sm font-bold text-white">Submit</button>
                </div>
            </div>

            <!-- Prompt list -->
            ${state.communityPrompts.length > 0 ? `
                <div class="space-y-2">
                    ${state.communityPrompts.map((p, i) => `
                        <div class="glow-card ${p.status === 'approved' ? 'glow-card-green' : ''} p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1">
                                    <p class="text-white text-sm font-medium">"${esc(p.prompt)}"</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-xs text-gray-500">by ${esc(p.author || 'Anon')}</span>
                                        ${p.status === 'approved' ? '<span class="text-xs text-green-400 font-bold">IN ROTATION</span>' : ''}
                                        ${p.status === 'pending' ? '<span class="text-[10px] font-mono text-consensus tracking-wider">NEEDS ' + (5 - (p.votes || 0)) + ' MORE</span>' : ''}
                                    </div>
                                </div>
                                <button data-action="voteCommunityPrompt" data-prompt-id="${esc(p.id)}" class="btn btn-ghost px-3 py-2 rounded-lg text-center shrink-0" ${p.status === 'approved' ? 'disabled' : ''}>
                                    <span class="text-lg block">\uD83D\uDC4D</span>
                                    <span class="text-xs text-gray-400">${p.votes || 0}</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-gray-500 text-center py-8">No submissions yet. Be the first!</p>'}
        </div>
    `;
}
