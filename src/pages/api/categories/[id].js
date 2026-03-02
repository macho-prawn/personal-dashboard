import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';

export const DELETE = async ({ params }) => {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return new Response(JSON.stringify({ error: 'Invalid category id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const linksResult = await query(
      'SELECT 1 FROM links WHERE category_id = $1 LIMIT 1',
      [id]
    );
    if (linksResult.rowCount > 0) {
      return new Response(
        JSON.stringify({ error: 'Delete all links in this category before deleting it' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await query(
      'DELETE FROM categories WHERE id = $1 RETURNING id, panel_id',
      [id]
    );
    if (!result.rowCount) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const panelId = result.rows[0].panel_id;
    await query(
      `DELETE FROM panels
       WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM categories WHERE panel_id = $1)`,
      [panelId]
    );

    logger.info('Category deleted', { id });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to delete category', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to delete category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
