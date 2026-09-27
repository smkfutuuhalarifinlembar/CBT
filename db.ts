import { Pool } from "pg";

/**
 * Lapisan database PostgreSQL lokal — pengganti Supabase.
 * Model data dipertahankan agar seluruh endpoint /api/db/* tidak berubah:
 *  - system_config : key-value JSONB (users, exams, submissions, classes, school_profile)
 *  - users         : tabel relasional untuk password_hash (scrypt)
 *  - schools       : sinkronisasi ringkas profil sekolah
 */

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "";
    if (!url) throw new Error("DATABASE_URL belum diset (lihat .env.example).");
    pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
    pool.on("error", (err) => console.error("[DB] Pool connection error:", err.message));
  }
  return pool;
}

/** Inisialisasi skema (idempotent). Aman dipanggil berkali-kali. */
export function initDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      try {
        const p = getPool();
        await p.query(`
          CREATE TABLE IF NOT EXISTS system_config (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '[]'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT DEFAULT '',
            password_hash TEXT DEFAULT '',
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT 'siswa',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
        console.log("[DB] Terhubung ke PostgreSQL — skema siap.");
      } catch (err) {
        ready = null; // izinkan percobaan ulang pada request berikutnya
        throw err;
      }
    })();
  }
  return ready;
}

async function db(): Promise<Pool> {
  await initDb();
  return getPool();
}

/* ---------------- system_config (key → JSONB) ---------------- */

export async function getConfig(key: string): Promise<any | null> {
  const p = await db();
  const { rows } = await p.query("SELECT data FROM system_config WHERE id = $1", [key]);
  return rows.length ? rows[0].data : null;
}

export async function setConfig(key: string, value: any): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO system_config (id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [key, JSON.stringify(value === undefined ? null : value)]
  );
}

export async function allConfig(): Promise<Record<string, any>> {
  const p = await db();
  const { rows } = await p.query("SELECT id, data FROM system_config");
  const map: Record<string, any> = {};
  rows.forEach((r: any) => {
    map[r.id] = r.data;
  });
  return map;
}

export async function countConfig(): Promise<number> {
  const p = await db();
  const { rows } = await p.query("SELECT count(*)::int AS c FROM system_config");
  return rows[0]?.c ?? 0;
}

/* ---------------- users (password_hash scrypt) ---------------- */

const UPSERT_USER_SQL = `
  INSERT INTO users (id, email, password_hash, full_name, role, is_active, updated_at)
  VALUES ($1, $2, $3, $4, $5, TRUE, now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = TRUE,
    updated_at = now()`;

export async function getUserPasswordHash(id: string): Promise<string | null> {
  const p = await db();
  const { rows } = await p.query("SELECT password_hash FROM users WHERE id = $1", [id]);
  return rows[0]?.password_hash || null;
}

export async function upsertUser(row: {
  id: string;
  email?: string;
  password_hash?: string;
  full_name?: string;
  role?: string;
}): Promise<void> {
  const p = await db();
  await p.query(UPSERT_USER_SQL, [
    row.id,
    row.email || "",
    row.password_hash || "",
    row.full_name || "",
    row.role || "siswa",
  ]);
}

export async function upsertUsers(
  rows: Array<{
    id: string;
    email?: string;
    password_hash?: string;
    full_name?: string;
    role?: string;
  }>
): Promise<void> {
  if (!rows.length) return;
  const p = await db();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(UPSERT_USER_SQL, [
        row.id,
        row.email || "",
        row.password_hash || "",
        row.full_name || "",
        row.role || "siswa",
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUserRow(id: string): Promise<void> {
  const p = await db();
  await p.query("DELETE FROM users WHERE id = $1", [id]);
}
