// Preact island: Self-updating countdown timer
// Reads phaseEndsAt from the room signal and counts down locally via RAF.

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { room, timeLeft as timeLeftSignal } from '../signals.js';

function formatTime(s) {
    if (s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function Timer({ maxTime = 40 }) {
    // Initialize from signal to prevent flash-to-zero on remount
    const [timeLeft, setTimeLeft] = useState(() => {
        const endsAt = room.value?.phaseEndsAt;
        return endsAt ? Math.max(0, Math.floor((endsAt - Date.now()) / 1000)) : 0;
    });
    const rafRef = useRef(null);

    useEffect(() => {
        function tick() {
            const endsAt = room.value?.phaseEndsAt;
            if (endsAt) {
                const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
                setTimeLeft(remaining);
                timeLeftSignal.value = remaining;
            }
            rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const isLow = timeLeft <= 10;
    const pct = Math.min(100, (timeLeft / maxTime) * 100);

    return h('div', null,
        h('div', { class: `text-3xl font-mono font-bold ${isLow ? 'countdown-critical text-red-500' : 'text-white'}` },
            formatTime(timeLeft)
        ),
        h('div', { class: 'h-[3px] bg-obsidian rounded-full overflow-hidden border border-white/[0.04] mt-2' },
            h('div', {
                class: `h-full timer-bar rounded-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-gradient-to-r from-wit to-oracle'}`,
                style: { width: `${pct}%` },
            })
        ),
        isLow && timeLeft > 0 && h('p', { class: 'text-red-400 text-xs font-mono mt-1 animate-pulse tracking-wider' }, 'HURRY UP!')
    );
}
