import { query } from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';
import { clean, isValidUrl } from '../../../lib/validators.js';

export const PUT = async ({ params, request }) => {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const name = clean(body.name);
    const url = clean(body.url);
    const description = clean(body.description);
    const categoryId = Number(body.categoryId);

    if (
      !Number.isInteger(id) ||
      id < 1 ||
      !name ||
      !isValidUrl(url) ||
      !Number.isInteger(categoryId)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid link payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query(
      `UPDATE links
       SET name = $1, url = $2, description = $3, category_id = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, category_id, name, url, description`,
      [name, url, description, categoryId, id]
    );

    if (!result.rowCount) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('Link updated', { id, categoryId });
    return new Response(JSON.stringify(result.rows[0]), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to update link', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to update link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE = async ({ params }) => {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return new Response(JSON.stringify({ error: 'Invalid link id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query('DELETE FROM links WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('Link deleted', { id });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to delete link', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to delete link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
