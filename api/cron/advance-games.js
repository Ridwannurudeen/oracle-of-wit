// Vercel Cron Job — advance stale game phases
// Runs every 60 seconds to catch games where all clients disconnected

import { redisKeys, redisGet } from '../lib/redis.js';
import { checkAutoAdvance, acquireAdvanceLock, releaseAdvanceLock } from '../lib/game-logic.js';
import { redisSet } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

async function setRoom(roomId, room) {
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();
    await redisSet(`room:${roomId}`, room);
    return true;
}

export default async function handler(req, res) {
    // Verify cron secret (Vercel sets this header)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const keys = await redisKeys('room:*');
    let advanced = 0;

    for (const key of keys) {
        const roomId = key.replace('room:', '');
        const room = await redisGet(`room:${roomId}`);
        if (!room?.phaseEndsAt) continue;
        if (Date.now() < room.phaseEndsAt) continue;

        const locked = await acquireAdvanceLock(roomId);
        if (!locked) continue;

        try {
            await checkAutoAdvance(room, setRoom);
            advanced++;
        } catch (e) {
            logger.error('Cron advance failed', { service: 'cron', roomId, error: e.message });
        } finally {
            await releaseAdvanceLock(roomId);
        }
    }

    logger.info('Cron advance-games completed', { service: 'cron', rooms: keys.length, advanced });
    return res.status(200).json({ ok: true, rooms: keys.length, advanced });
}
