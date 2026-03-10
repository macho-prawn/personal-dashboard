import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid reorder payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalized = items
      .map((item) => ({
        id: Number(item.id),
        categoryId: Number(item.categoryId),
        sortOrder: Number(item.sortOrder)
      }))
      .filter((item) =>
        Number.isInteger(item.id) && item.id > 0 &&
        Number.isInteger(item.categoryId) && item.categoryId > 0 &&
        Number.isInteger(item.sortOrder) && item.sortOrder > 0
      );

    if (normalized.length !== items.length) {
      return new Response(JSON.stringify({ error: 'Invalid link reorder payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (const item of normalized) {
      await query(
        `UPDATE links
         SET category_id = $1, sort_order = $2, updated_at = NOW()
         WHERE id = $3`,
        [item.categoryId, item.sortOrder, item.id]
      );
    }

    logger.info('Links reordered', { count: normalized.length });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to reorder links', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to reorder links' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
