// Preact island: Profile display card with XP bar
// Reads from profile signal — auto-updates when syncFromLegacyState runs.

import { h } from 'preact';
import { profile, xpProgress } from '../signals.js';

export function ProfileCard() {
    const p = profile.value;
    if (!p) return h('div', { class: 'glow-card p-4 animate-pulse' },
        h('div', { class: 'h-4 bg-gray-800 rounded w-1/2 mb-2' }),
        h('div', { class: 'h-3 bg-gray-800 rounded w-1/3' })
    );

    const progress = xpProgress.value;

    return h('div', { class: 'glow-card p-4' },
        h('div', { class: 'flex items-center gap-3 mb-3' },
            h('div', { class: 'w-10 h-10 rounded-xl bg-wit/20 border border-wit/30 flex items-center justify-center' },
                h('span', { class: 'text-sm font-mono font-bold text-wit' }, p.level)
            ),
            h('div', null,
                h('p', { class: 'font-display font-bold text-white text-sm tracking-wider' }, p.title || 'Joke Rookie'),
                h('p', { class: 'text-[10px] font-mono text-gray-500' },
                    (p.lifetimeXP || 0).toLocaleString(), ' XP'
                )
            )
        ),
        h('div', { class: 'h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]' },
            h('div', {
                class: 'h-full rounded-full bg-gradient-to-r from-wit to-oracle transition-all duration-500',
                style: { width: `${progress}%` },
            })
        ),
        h('div', { class: 'flex justify-between mt-1.5' },
            h('span', { class: 'text-[9px] font-mono text-gray-600' }, 'Lv.', p.level),
            h('span', { class: 'text-[9px] font-mono text-gray-600' }, 'Lv.', (p.level || 0) + 1)
        )
    );
}
