import { logger } from '../../../../lib/logger.js';
import { requireDbOpsAccess, restoreDatabaseBackup } from '../../../../lib/dbOps.js';

export const POST = async ({ request }) => {
  try {
    requireDbOpsAccess(request);

    const payload = await request.json().catch(() => ({}));
    const backup = await restoreDatabaseBackup(payload.filename);

    logger.info('Database restored from backup', {
      filename: backup.filename,
      restoreName: backup.restoreName
    });

    return new Response(JSON.stringify({
      backup,
      message: `Database restored from ${backup.restoreName}. Restart the personal-dashboard to ensure the restored database is picked up.`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const status = error?.status || 500;
    logger.error('Database restore failed', { error: error.message, status });
    return new Response(JSON.stringify({ error: error.message || 'Failed to restore backup' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
