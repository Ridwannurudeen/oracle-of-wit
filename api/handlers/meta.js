// Config/meta handlers

import { getCurrentTheme } from '../lib/constants.js';

/**
 * Get the current weekly theme.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getWeeklyTheme(body, ctx) {
    const theme = getCurrentTheme();
    return { status: 200, data: { success: true, theme: { name: theme.name, emoji: theme.emoji, description: theme.description } } };
}
