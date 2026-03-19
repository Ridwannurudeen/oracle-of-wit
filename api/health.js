// Health check endpoint — verifies Redis and GenLayer connectivity

import { redisHealthCheck } from './lib/redis.js';
import { getGenLayerClient } from './lib/genlayer.js';
import { getMetrics } from './lib/monitor.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store');

    const checks = {};

    // Redis
    checks.redis = await redisHealthCheck();

    // GenLayer SDK
    try {
        const client = await getGenLayerClient();
        checks.genlayer = client !== null;
    } catch {
        checks.genlayer = false;
    }

    const healthy = checks.redis; // Redis is required; GenLayer is optional
    const status = healthy ? 'healthy' : 'degraded';

    return res.status(healthy ? 200 : 503).json({
        status,
        checks,
        metrics: getMetrics(),
        timestamp: new Date().toISOString(),
    });
}
