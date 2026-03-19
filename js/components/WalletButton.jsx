// Preact island: Connect/disconnect wallet button
// Reads from wallet signals — dispatches actions via data-action attributes.

import { h } from 'preact';
import { walletAddress, isWalletConnected, walletDisplayAddress, walletConnecting } from '../signals.js';

export function WalletButton() {
    const connected = isWalletConnected.value;
    const connecting = walletConnecting.value;
    const displayAddr = walletDisplayAddress.value;

    if (connected) {
        return h('div', { class: 'wallet-button-island flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg' },
            h('div', { class: 'w-2 h-2 rounded-full bg-green-500' }),
            h('span', { class: 'text-[10px] font-mono text-green-400' }, displayAddr),
            h('button', {
                'data-action': 'disconnectWallet',
                class: 'text-[9px] font-mono text-gray-500 hover:text-red-400 transition-colors ml-1',
            }, 'x')
        );
    }

    return h('button', {
        'data-action': 'connectWallet',
        'data-hover-sound': 'true',
        class: `wallet-button-island flex items-center gap-1.5 px-3 py-1.5 border border-oracle/30 rounded-lg text-[10px] font-mono text-oracle hover:bg-oracle/10 transition-all ${connecting ? 'opacity-50 pointer-events-none' : ''}`,
    },
        connecting
            ? h('span', null, 'CONNECTING...')
            : h('span', null, 'CONNECT WALLET')
    );
}
