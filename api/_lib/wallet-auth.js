// Wallet authentication using EIP-4361 (Sign-In with Ethereum / SIWE)

import crypto from 'crypto';
import { redisSet, redisGet, redisDel } from './redis.js';
import { logger } from './logger.js';

const NONCE_TTL = 300; // 5 minutes

/**
 * Generate a cryptographically random nonce.
 * @returns {string}
 */
export function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Store a nonce in Redis with TTL.
 * @param {string} nonce
 * @returns {Promise<void>}
 */
export async function storeNonce(nonce) {
    await redisSet(`siwe:nonce:${nonce}`, true, NONCE_TTL);
}

/**
 * Consume (validate and delete) a nonce. Returns true if valid.
 * @param {string} nonce
 * @returns {Promise<boolean>}
 */
export async function consumeNonce(nonce) {
    const exists = await redisGet(`siwe:nonce:${nonce}`);
    if (!exists) return false;
    await redisDel(`siwe:nonce:${nonce}`);
    return true;
}

/**
 * Verify a SIWE message and signature. Returns the parsed SIWE message
 * with the verified wallet address, or null on failure.
 * @param {string} message - The raw SIWE message string.
 * @param {string} signature - The hex signature from MetaMask.
 * @returns {Promise<{address: string, nonce: string}|null>}
 */
export async function verifySiweMessage(message, signature) {
    try {
        const { SiweMessage } = await import('siwe');
        const siweMsg = new SiweMessage(message);
        const result = await siweMsg.verify({ signature });
        if (!result.success) {
            logger.warn('SIWE verification failed', { service: 'wallet-auth' });
            return null;
        }
        return { address: siweMsg.address, nonce: siweMsg.nonce };
    } catch (e) {
        logger.warn('SIWE verify error', { service: 'wallet-auth', error: e.message });
        return null;
    }
}
