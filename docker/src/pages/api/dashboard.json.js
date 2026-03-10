import { query } from '../../lib/db.js';
import { getDbOpsUiConfig, listDatabaseBackups } from '../../lib/dbOps.js';
import { logger } from '../../lib/logger.js';
import { APP_INSTANCE_ID } from '../../lib/runtime.js';

export const GET = async () => {
  try {
    logger.info('GET /api/dashboard.json');

    const categoriesRes = await query(
      'SELECT id, panel_id, name, sort_order FROM categories ORDER BY panel_id ASC, sort_order ASC, id ASC'
    );
    const panelsRes = await query(
      'SELECT id, name, sort_order FROM panels ORDER BY sort_order ASC, id ASC'
    );
    const linksRes = await query(
      'SELECT id, category_id, name, url, description, sort_order FROM links ORDER BY category_id ASC, sort_order ASC, id ASC'
    );

    const categories = categoriesRes.rows.map((category) => ({
      ...category,
      links: linksRes.rows.filter((link) => link.category_id === category.id)
    }));

    const dbOps = getDbOpsUiConfig();
    if (dbOps.enabled) {
      dbOps.backups = await listDatabaseBackups({ limit: dbOps.restoreLimit });
    }

    return new Response(
      JSON.stringify({
        profile: {
          name: process.env.APP_USERNAME || 'Your Name',
          title: process.env.APP_USERTITLE || 'Software Engineer',
          email: process.env.APP_USEREMAIL || 'you@example.com'
        },
        appInstanceId: APP_INSTANCE_ID,
        dbOps,
        panels: panelsRes.rows,
        categories
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('GET /api/dashboard.json failed', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to load dashboard data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
