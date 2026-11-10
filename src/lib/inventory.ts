import type { PoolClient } from "pg";
import { ensureSchema, pool } from "./db";
import { ApiError } from "./http";
import type { BatchInput } from "./validate";

export type Batch = {
  id: number;
  name: string;
  batch: string;
  expiry: string;
  location: string;
  received: number;
  dispensed: number;
};

export type Movement = {
  id: number;
  kind: "in" | "out" | "adj";
  qty: number | null;
  note: string;
  at: string;
};

const COLS = `id, name, batch_no AS batch, expiry, location, received, dispensed`;

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {}
    if ((e as { code?: string }).code === "23505") {
      throw new ApiError(409, "هذي الدفعة (نفس الاسم والباج نمبر) مسجلة من قبل.");
    }
    throw e;
  } finally {
    c.release();
  }
}

export async function listBatches(): Promise<Batch[]> {
  await ensureSchema();
  const r = await pool().query<Batch>(`SELECT ${COLS} FROM batches ORDER BY expiry, name`);
  return r.rows;
}

export async function receive(inp: BatchInput): Promise<{ batch: Batch; merged: boolean }> {
  return tx(async (c) => {
    const ex = await c.query<Batch>(
      `SELECT ${COLS} FROM batches
       WHERE lower(name) = lower($1) AND lower(batch_no) = lower($2) FOR UPDATE`,
      [inp.name, inp.batch],
    );
    const cur = ex.rows[0];

    if (cur) {
      if (cur.expiry !== inp.expiry) {
        throw new ApiError(
          409,
          `هذا الباج نمبر مسجل بتاريخ انتهاء ${cur.expiry}. صحّح التاريخ أو عدّل الدفعة الموجودة.`,
        );
      }
      const u = await c.query<Batch>(
        `UPDATE batches
         SET received = received + $2,
             dispensed = dispensed + $3,
             location = CASE WHEN $4::text <> '' THEN $4::text ELSE location END
         WHERE id = $1 RETURNING ${COLS}`,
        [cur.id, inp.received, inp.dispensed, inp.location],
      );
      await c.query(`INSERT INTO movements (batch_id, kind, qty) VALUES ($1, 'in', $2)`, [
        cur.id,
        inp.received,
      ]);
      if (inp.dispensed > 0) {
        await c.query(
          `INSERT INTO movements (batch_id, kind, qty, note) VALUES ($1, 'out', $2, 'عند الاستلام')`,
          [cur.id, inp.dispensed],
        );
      }
      return { batch: u.rows[0], merged: true };
    }

    const ins = await c.query<Batch>(
      `INSERT INTO batches (name, batch_no, expiry, location, received, dispensed)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
      [inp.name, inp.batch, inp.expiry, inp.location, inp.received, inp.dispensed],
    );
    const row = ins.rows[0];
    await c.query(`INSERT INTO movements (batch_id, kind, qty) VALUES ($1, 'in', $2)`, [
      row.id,
      inp.received,
    ]);
    if (inp.dispensed > 0) {
      await c.query(
        `INSERT INTO movements (batch_id, kind, qty, note) VALUES ($1, 'out', $2, 'عند الاستلام')`,
        [row.id, inp.dispensed],
      );
    }
    return { batch: row, merged: false };
  });
}

export async function updateBatch(id: number, inp: BatchInput): Promise<Batch> {
  return tx(async (c) => {
    const ex = await c.query<Batch>(`SELECT ${COLS} FROM batches WHERE id = $1 FOR UPDATE`, [id]);
    const cur = ex.rows[0];
    if (!cur) throw new ApiError(404, "هذي الدفعة مو موجودة (يمكن انحذفت).");

    const dup = await c.query(
      `SELECT 1 FROM batches
       WHERE lower(name) = lower($1) AND lower(batch_no) = lower($2) AND id <> $3`,
      [inp.name, inp.batch, id],
    );
    if (dup.rowCount) throw new ApiError(409, "عندك دفعة ثانية بنفس الاسم والباج نمبر.");

    const u = await c.query<Batch>(
      `UPDATE batches
       SET name = $2, batch_no = $3, expiry = $4, location = $5, received = $6, dispensed = $7
       WHERE id = $1 RETURNING ${COLS}`,
      [id, inp.name, inp.batch, inp.expiry, inp.location, inp.received, inp.dispensed],
    );
    if (cur.received !== inp.received || cur.dispensed !== inp.dispensed) {
      await c.query(
        `INSERT INTO movements (batch_id, kind, qty, note) VALUES ($1, 'adj', NULL, $2)`,
        [
          id,
          `الكمية ${cur.received} ← ${inp.received}، المصروف ${cur.dispensed} ← ${inp.dispensed}`,
        ],
      );
    }
    return u.rows[0];
  });
}

export async function dispense(id: number, qty: number, note: string): Promise<Batch> {
  return tx(async (c) => {
    const u = await c.query<Batch>(
      `UPDATE batches SET dispensed = dispensed + $2
       WHERE id = $1 AND received - dispensed >= $2 RETURNING ${COLS}`,
      [id, qty],
    );
    if (!u.rows[0]) {
      const e = await c.query<{ rem: number }>(
        `SELECT received - dispensed AS rem FROM batches WHERE id = $1`,
        [id],
      );
      if (!e.rows[0]) throw new ApiError(404, "هذي الدفعة مو موجودة (يمكن انحذفت).");
      throw new ApiError(409, `الكمية أكبر من المتبقي (${e.rows[0].rem}).`);
    }
    await c.query(
      `INSERT INTO movements (batch_id, kind, qty, note) VALUES ($1, 'out', $2, $3)`,
      [id, qty, note],
    );
    return u.rows[0];
  });
}

export async function removeBatch(id: number): Promise<void> {
  await ensureSchema();
  const r = await pool().query(`DELETE FROM batches WHERE id = $1`, [id]);
  if (!r.rowCount) throw new ApiError(404, "هذي الدفعة مو موجودة.");
}

export async function batchLog(id: number): Promise<Movement[]> {
  await ensureSchema();
  const r = await pool().query<Movement>(
    `SELECT id, kind, qty, note, created_at AS at
     FROM movements WHERE batch_id = $1 ORDER BY created_at DESC, id DESC`,
    [id],
  );
  return r.rows;
}
