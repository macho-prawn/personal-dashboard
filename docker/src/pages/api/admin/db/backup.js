import { createDatabaseBackup, requireDbOpsAccess } from '../../../../lib/dbOps.js';
import { logger } from '../../../../lib/logger.js';

export const POST = async ({ request }) => {
  try {
    requireDbOpsAccess(request);
    const result = await createDatabaseBackup();
    const { backup, deletedBackups, limit } = result;
    const deletedCount = deletedBackups.length;
    const message = deletedCount
      ? `Backup created: ${backup.filename}. Only ${limit} backups are kept. ${deletedCount} older backup file${deletedCount === 1 ? ' was' : 's were'} deleted.`
      : `Backup created: ${backup.filename}. Only ${limit} backups are kept. If a new backup exceeds that limit, older backup files are deleted.`;

    logger.info('Database backup created', {
      filename: backup.filename,
      sizeBytes: backup.sizeBytes,
      deletedBackups: deletedCount,
      limit
    });

    return new Response(JSON.stringify({
      backup,
      deletedBackups,
      limit,
      message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const status = error?.status || 500;
    logger.error('Database backup failed', { error: error.message, status });
    return new Response(JSON.stringify({ error: error.message || 'Failed to create backup' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
