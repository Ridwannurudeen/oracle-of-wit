// Config/meta handlers

import { getCurrentTheme } from '../_lib/constants.js';

/**
 * Get the current weekly theme.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function getWeeklyTheme(body, ctx) {
    const theme = getCurrentTheme();
    return { status: 200, data: { success: true, theme: { name: theme.name, emoji: theme.emoji, description: theme.description } } };
}
