import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const ids = Array.isArray(body.orderedPanelIds) ? body.orderedPanelIds : [];

    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid reorder payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const uniqueIds = [...new Set(ids.map((value) => Number(value)).filter((n) => Number.isInteger(n) && n > 0))];
    if (uniqueIds.length !== ids.length) {
      return new Response(JSON.stringify({ error: 'Invalid panel ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (let i = 0; i < uniqueIds.length; i += 1) {
      await query('UPDATE panels SET sort_order = $1 WHERE id = $2', [i + 1, uniqueIds[i]]);
    }

    logger.info('Panels reordered', { count: uniqueIds.length });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to reorder panels', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to reorder panels' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
