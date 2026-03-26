// Health check endpoint — verifies Redis and GenLayer connectivity

import { redisHealthCheck } from './_lib/redis.js';
import { getGenLayerClient, isGenLayerAvailable } from './_lib/genlayer.js';
import { getMetrics } from './_lib/monitor.js';

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

    // Circuit breaker status
    checks.genlayerCircuit = isGenLayerAvailable();

    const healthy = checks.redis && checks.genlayer;
    const status = healthy ? 'healthy' : checks.redis ? 'degraded' : 'unhealthy';

    return res.status(healthy ? 200 : 503).json({
        status,
        checks,
        metrics: getMetrics(),
        timestamp: new Date().toISOString(),
    });
}
