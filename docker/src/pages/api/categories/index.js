import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';
import { clean } from '../../../lib/validators.js';

export const POST = async ({ request }) => {
  let categoryName = '';
  try {
    const body = await request.json();
    const name = clean(body.name);
    categoryName = name;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Category name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query(
      `WITH new_panel AS (
         INSERT INTO panels (name, sort_order)
         VALUES (
           $1,
           (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM panels)
         )
         RETURNING id
       ), next_order AS (
         SELECT COALESCE(MAX(sort_order), 0) + 1 AS value
         FROM categories
         WHERE panel_id = (SELECT id FROM new_panel)
       )
       INSERT INTO categories (panel_id, name, sort_order)
       SELECT id, $1, (SELECT value FROM next_order) FROM new_panel
       RETURNING id, panel_id, name, sort_order`,
      [name]
    );

    logger.info('Category created', {
      id: result.rows[0].id,
      panelId: result.rows[0].panel_id,
      name
    });
    return new Response(JSON.stringify(result.rows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const isDuplicate =
      error?.code === '23505' ||
      String(error?.message || '').toLowerCase().includes('duplicate key value');

    if (isDuplicate) {
      logger.warn('Duplicate category rejected', { name: categoryName });
      return new Response(JSON.stringify({ error: 'Category/panel already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.error('Failed to create category', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to create category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
