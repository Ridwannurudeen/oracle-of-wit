// Structured JSON logger for serverless API

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level) {
    return LEVELS[level] >= (LEVELS[LOG_LEVEL] || 1);
}

function log(level, message, meta = {}) {
    if (!shouldLog(level)) return;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    // Remove undefined values
    for (const key of Object.keys(entry)) {
        if (entry[key] === undefined) delete entry[key];
    }
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

export const logger = {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
};
