// Request monitoring — tracks error rates, slow requests, and API health metrics
// No external dependencies — uses structured logging for Vercel log drain integration

import { logger } from './logger.js';

const metrics = {
    requests: 0,
    errors: 0,
    slowRequests: 0,
    lastErrors: [],     // circular buffer of last 10 errors
    startTime: Date.now(),
};

const SLOW_THRESHOLD = parseInt(process.env.SLOW_REQUEST_MS) || 3000;

/**
 * Track a completed request for monitoring.
 * @param {string} action - The API action name
 * @param {number} duration - Request duration in ms
 * @param {number} status - HTTP status code
 * @param {string|null} [error] - Error message if failed
 */
export function trackRequest(action, duration, status, error = null) {
    metrics.requests++;

    if (status >= 500) {
        metrics.errors++;
        metrics.lastErrors.push({
            action,
            error: error?.slice(0, 200),
            timestamp: new Date().toISOString(),
        });
        if (metrics.lastErrors.length > 10) metrics.lastErrors.shift();
    }

    if (duration > SLOW_THRESHOLD) {
        metrics.slowRequests++;
        logger.warn('Slow request detected', {
            service: 'monitor',
            action,
            duration,
            threshold: SLOW_THRESHOLD,
        });
    }
}

/**
 * Get current monitoring metrics.
 * @returns {Object} Current metrics snapshot
 */
export function getMetrics() {
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
    const errorRate = metrics.requests > 0
        ? ((metrics.errors / metrics.requests) * 100).toFixed(2)
        : '0.00';

    return {
        uptime,
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: `${errorRate}%`,
        slowRequests: metrics.slowRequests,
        lastErrors: metrics.lastErrors,
    };
}
