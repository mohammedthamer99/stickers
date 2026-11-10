import { Pool, types } from "pg";

// DATE يرجع نص بصيغة YYYY-MM-DD (مو كائن Date) حتى ما يتأثر بالمنطقة الزمنية.
types.setTypeParser(1082, (v: string) => v);
// BIGINT (id) يرجع رقم عادي.
types.setTypeParser(20, (v: string) => parseInt(v, 10));

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS batches (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  batch_no   TEXT        NOT NULL,
  expiry     DATE        NOT NULL,
  location   TEXT        NOT NULL DEFAULT '',
  received   INTEGER     NOT NULL CHECK (received >= 0),
  dispensed  INTEGER     NOT NULL DEFAULT 0 CHECK (dispensed >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (dispensed <= received)
);
CREATE UNIQUE INDEX IF NOT EXISTS batches_name_batch_uq
  ON batches (lower(name), lower(batch_no));
CREATE TABLE IF NOT EXISTS movements (
  id         BIGSERIAL PRIMARY KEY,
  batch_id   BIGINT      NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  kind       TEXT        NOT NULL CHECK (kind IN ('in', 'out', 'adj')),
  qty        INTEGER,
  note       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movements_batch_idx ON movements (batch_id, created_at);
`;

const g = globalThis as unknown as {
  __pool?: Pool;
  __schema?: Promise<void>;
};

export function pool(): Pool {
  if (!g.__pool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
      throw new Error("DATABASE_URL مو مضبوط. شوف ملف README.");
    }
    const url = new URL(raw);
    const mode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const useSsl = !local && mode !== "disable";
    g.__pool = new Pool({
      connectionString: url.toString(),
      max: 3,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }
  return g.__pool;
}

/** ينشئ الجداول إذا مو موجودة. يشتغل مرة وحدة لكل instance. */
export function ensureSchema(): Promise<void> {
  if (!g.__schema) {
    g.__schema = (async () => {
      const c = await pool().connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(727001)");
        await c.query(SCHEMA_SQL);
        await c.query("COMMIT");
      } catch (e) {
        try {
          await c.query("ROLLBACK");
        } catch {}
        throw e;
      } finally {
        c.release();
      }
    })().catch((e) => {
      g.__schema = undefined;
      throw e;
    });
  }
  return g.__schema;
}
