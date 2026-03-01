import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

const buildConnectionString = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const protocol = process.env.DB_PROTOCOL || 'postgresql';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || process.env.POSTGRES_USER;
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.DB_NAME || process.env.POSTGRES_DB;

  if (!user || !password || !database) {
    throw new Error(
      'Missing database config. Set DATABASE_URL or DB_USER/DB_PASSWORD/DB_NAME.'
    );
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `${protocol}://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
};

const connectionString = buildConnectionString();
logger.info('Database connection configured', {
  source: process.env.DATABASE_URL ? 'DATABASE_URL' : 'DB_* variables'
});

const pool = new Pool({ connectionString });
let initialized = false;

export const initDb = async () => {
  if (initialized) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS panels (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE panels
      ADD COLUMN IF NOT EXISTS sort_order INTEGER;
    `);

    await client.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS next_order
        FROM panels
      )
      UPDATE panels p
      SET sort_order = r.next_order
      FROM ranked r
      WHERE p.id = r.id AND (p.sort_order IS NULL OR p.sort_order < 1);
    `);

    await client.query(`
      ALTER TABLE panels
      ALTER COLUMN sort_order SET NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS panel_id INTEGER;
    `);

    await client.query(`
      INSERT INTO panels (name)
      SELECT DISTINCT c.name
      FROM categories c
      LEFT JOIN panels p ON p.name = c.name
      WHERE c.panel_id IS NULL AND p.id IS NULL;
    `);

    await client.query(`
      UPDATE categories c
      SET panel_id = p.id
      FROM panels p
      WHERE c.panel_id IS NULL AND p.name = c.name;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'categories_panel_id_fkey'
        ) THEN
          ALTER TABLE categories
          ADD CONSTRAINT categories_panel_id_fkey
          FOREIGN KEY (panel_id)
          REFERENCES panels(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE categories
      ALTER COLUMN panel_id SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS sort_order INTEGER;
    `);

    await client.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY panel_id ORDER BY created_at ASC, id ASC) AS next_order
        FROM categories
      )
      UPDATE categories c
      SET sort_order = r.next_order
      FROM ranked r
      WHERE c.id = r.id AND (c.sort_order IS NULL OR c.sort_order < 1);
    `);

    await client.query(`
      ALTER TABLE categories
      ALTER COLUMN sort_order SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE categories
      DROP CONSTRAINT IF EXISTS categories_name_key;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS categories_panel_id_name_key
      ON categories (panel_id, name);
    `);

    await client.query(`
      DELETE FROM panels p
      WHERE NOT EXISTS (
        SELECT 1 FROM categories c WHERE c.panel_id = p.id
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE links
      ADD COLUMN IF NOT EXISTS sort_order INTEGER;
    `);

    await client.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC, id ASC) AS next_order
        FROM links
      )
      UPDATE links l
      SET sort_order = r.next_order
      FROM ranked r
      WHERE l.id = r.id AND (l.sort_order IS NULL OR l.sort_order < 1);
    `);

    await client.query(`
      ALTER TABLE links
      ALTER COLUMN sort_order SET NOT NULL;
    `);

    initialized = true;
    logger.info('Database initialized');
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

export const query = async (text, params = []) => {
  await initDb();
  return pool.query(text, params);
};
