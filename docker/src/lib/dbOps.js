import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { getConnectionString } from './db.js';
import { logger } from './logger.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const BACKUP_EXTENSION = '.sql';
const BACKUP_PREFIX = 'db-backup-';
const BACKUP_NAME_LIMIT = 5;

const jsonError = (message, status = 500) => Object.assign(new Error(message), { status });

const parseRetentionDays = () => {
  const value = Number(process.env.DB_BACKUP_RETENTION_DAYS || 7);
  return Number.isInteger(value) && value >= 0 ? value : 7;
};

const createTimestamp = () => new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');

const compareSecret = (provided, expected) => {
  const left = Buffer.from(String(provided || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const backupFilename = () => `${BACKUP_PREFIX}${createTimestamp()}${BACKUP_EXTENSION}`;

const backupFileToRestoreName = (fileName) => {
  const normalized = String(fileName || '')
    .replace(BACKUP_PREFIX, '')
    .replace(BACKUP_EXTENSION, '');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/);

  if (!match) {
    return fileName;
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
};

const backupFileToMeta = async (filePath, fileName) => {
  const details = await stat(filePath);
  return {
    createdAt: new Date(details.mtimeMs).toISOString(),
    filename: fileName,
    path: filePath,
    restoreName: backupFileToRestoreName(fileName),
    sizeBytes: details.size
  };
};

const runCommand = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['ignore', 'ignore', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
  });
});

const ensureBackupDir = async () => {
  const backupDir = process.env.DB_BACKUP_DIR || path.join(process.cwd(), 'backups');
  await mkdir(backupDir, { recursive: true });
  await access(backupDir, fsConstants.W_OK);
  return backupDir;
};

const readBackupEntries = async () => {
  const backupDir = await ensureBackupDir();
  const entries = await readdir(backupDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXTENSION));

  const withMeta = await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(backupDir, fileName);
      return backupFileToMeta(filePath, fileName);
    })
  );

  return withMeta.sort((left, right) => {
    if (right.createdAt !== left.createdAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return right.filename.localeCompare(left.filename);
  });
};

const sanitizeBackupFileName = (fileName) => {
  const value = path.basename(String(fileName || '').trim());
  if (!value.startsWith(BACKUP_PREFIX) || !value.endsWith(BACKUP_EXTENSION)) {
    throw jsonError('Invalid backup filename', 400);
  }
  return value;
};

const toPublicBackupMeta = (backup) => ({
  createdAt: backup.createdAt,
  filename: backup.filename,
  restoreName: backup.restoreName,
  sizeBytes: backup.sizeBytes
});

const pruneExpiredBackups = async () => {
  const retentionDays = parseRetentionDays();
  if (retentionDays < 1) return;

  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const backups = await readBackupEntries();
  const expired = backups.filter((backup) => {
    const backupTime = Date.parse(backup.createdAt);
    return Number.isFinite(backupTime) && backupTime < cutoff;
  });

  await Promise.all(expired.map((backup) => rm(backup.path, { force: true })));
  if (expired.length) {
    logger.info('Pruned old database backups', {
      count: expired.length,
      retentionDays
    });
  }
};

const pruneBackupCount = async () => {
  const backups = await readBackupEntries();
  const staleBackups = backups.slice(BACKUP_NAME_LIMIT);

  await Promise.all(staleBackups.map((backup) => rm(backup.path, { force: true })));
  if (staleBackups.length) {
    logger.info('Pruned database backups over count limit', {
      count: staleBackups.length,
      limit: BACKUP_NAME_LIMIT
    });
  }

  return staleBackups.map(toPublicBackupMeta);
};

export const isDbOpsEnabled = () => TRUE_VALUES.has(String(process.env.DB_OPS_ENABLED || '').toLowerCase());

export const hasDbOpsSecretConfigured = () => String(process.env.DB_OPS_SECRET || '').trim().length > 0;

export const getDbOpsUiConfig = () => ({
  enabled: isDbOpsEnabled() && hasDbOpsSecretConfigured(),
  retentionDays: parseRetentionDays(),
  restoreLimit: BACKUP_NAME_LIMIT
});

export const listDatabaseBackups = async (options = {}) => {
  const limit = Math.min(
    BACKUP_NAME_LIMIT,
    Math.max(0, Number.parseInt(options.limit ?? BACKUP_NAME_LIMIT, 10) || BACKUP_NAME_LIMIT)
  );
  const backups = await readBackupEntries();
  return backups.slice(0, limit).map(toPublicBackupMeta);
};

export const requireDbOpsAccess = (request) => {
  if (!isDbOpsEnabled()) {
    throw jsonError('Database operations are disabled', 404);
  }

  const expectedSecret = String(process.env.DB_OPS_SECRET || '').trim();
  if (!expectedSecret) {
    throw jsonError('Database operations are not configured', 503);
  }

  const providedSecret = request.headers.get('x-db-ops-secret') || '';
  if (!providedSecret) {
    throw jsonError('Admin secret is required', 401);
  }

  if (!compareSecret(providedSecret, expectedSecret)) {
    throw jsonError('Invalid admin secret', 403);
  }
};

export const createDatabaseBackup = async () => {
  const backupDir = await ensureBackupDir();
  const fileName = backupFilename();
  const filePath = path.join(backupDir, fileName);

  try {
    await runCommand('pg_dump', [
      '--clean',
      '--dbname',
      getConnectionString(),
      '--encoding=UTF8',
      '--file',
      filePath,
      '--format=plain',
      '--if-exists',
      '--no-owner',
      '--no-privileges'
    ]);
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => {});
    throw error;
  }

  await pruneExpiredBackups();
  const deletedBackups = await pruneBackupCount();
  return {
    backup: toPublicBackupMeta(await backupFileToMeta(filePath, fileName)),
    deletedBackups,
    limit: BACKUP_NAME_LIMIT
  };
};

export const restoreDatabaseBackup = async (fileName) => {
  const requestedFileName = sanitizeBackupFileName(fileName);
  const backups = await readBackupEntries();
  const backup = backups.find((entry) => entry.filename === requestedFileName);

  if (!backup) {
    throw jsonError('Requested backup was not found', 404);
  }

  await runCommand('psql', [
    '--dbname',
    getConnectionString(),
    '--file',
    backup.path,
    '--set',
    'ON_ERROR_STOP=1'
  ]);

  return toPublicBackupMeta(backup);
};
