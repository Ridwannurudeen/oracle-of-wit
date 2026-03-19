// Preact islands — mount components into data-island placeholder containers.
// Called after every render() once DOM placeholders exist.

import { render, h } from 'preact';
import { ProfileCard } from './components/ProfileCard.jsx';
import { Timer } from './components/Timer.jsx';
import { WalletButton } from './components/WalletButton.jsx';

export function mountIslands() {
    // ProfileCard
    const pcEl = document.querySelector('[data-island="profile-card"]');
    if (pcEl) render(h(ProfileCard, null), pcEl);

    // Timer — pass maxTime based on current phase
    const timerEl = document.querySelector('[data-island="timer"]');
    if (timerEl) {
        const maxTime = parseInt(timerEl.dataset.maxTime || '40');
        render(h(Timer, { maxTime }), timerEl);
    }

    // WalletButton
    const wbEl = document.querySelector('[data-island="wallet-button"]');
    if (wbEl) render(h(WalletButton, null), wbEl);
}
