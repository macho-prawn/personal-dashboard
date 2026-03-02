import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';
import { clean, isValidUrl } from '../../../lib/validators.js';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const name = clean(body.name);
    const url = clean(body.url);
    const description = clean(body.description);
    const categoryId = Number(body.categoryId);

    if (!name || !isValidUrl(url) || !Number.isInteger(categoryId)) {
      return new Response(JSON.stringify({ error: 'Invalid link payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const duplicate = await query(
      `SELECT id
       FROM links
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [name]
    );
    if (duplicate.rowCount) {
      return new Response(JSON.stringify({ error: 'Duplicate link name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query(
      `WITH next_order AS (
         SELECT COALESCE(MAX(sort_order), 0) + 1 AS value
         FROM links
         WHERE category_id = $1
       )
       INSERT INTO links (category_id, name, url, description, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT value FROM next_order))
       RETURNING id, category_id, name, url, description, sort_order`,
      [categoryId, name, url, description]
    );

    logger.info('Link created', { id: result.rows[0].id, categoryId });
    return new Response(JSON.stringify(result.rows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to create link', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to create link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
