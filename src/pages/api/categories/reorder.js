import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const panelId = Number(body.panelId);
    const ids = Array.isArray(body.orderedCategoryIds) ? body.orderedCategoryIds : [];

    if (!Number.isInteger(panelId) || panelId < 1 || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid reorder payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const uniqueIds = [...new Set(ids.map((value) => Number(value)).filter((n) => Number.isInteger(n) && n > 0))];
    if (uniqueIds.length !== ids.length) {
      return new Response(JSON.stringify({ error: 'Invalid category ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (let i = 0; i < uniqueIds.length; i += 1) {
      await query(
        `UPDATE categories
         SET sort_order = $1
         WHERE id = $2 AND panel_id = $3`,
        [i + 1, uniqueIds[i], panelId]
      );
    }

    logger.info('Categories reordered', { panelId, count: uniqueIds.length });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to reorder categories', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to reorder categories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
