-- مرجع فقط: النظام ينشئ هذي الجداول لحاله عند أول تشغيل.
-- تكدر تلصقه بـ SQL Editor إذا تريد تنشئها يدوياً.

CREATE TABLE IF NOT EXISTS batches (
  id         BIGSERIAL PRIMARY KEY,
  warehouse  SMALLINT    NOT NULL DEFAULT 1,
  name       TEXT        NOT NULL,
  batch_no   TEXT        NOT NULL,
  expiry     DATE        NOT NULL,
  location   TEXT        NOT NULL DEFAULT '',
  received   INTEGER     NOT NULL CHECK (received >= 0),
  dispensed  INTEGER     NOT NULL DEFAULT 0 CHECK (dispensed >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (dispensed <= received)
);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS warehouse SMALLINT NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS batches_name_batch_uq;

CREATE UNIQUE INDEX IF NOT EXISTS batches_wh_name_batch_uq
  ON batches (warehouse, lower(name), lower(batch_no));

CREATE TABLE IF NOT EXISTS movements (
  id         BIGSERIAL PRIMARY KEY,
  batch_id   BIGINT      NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  kind       TEXT        NOT NULL CHECK (kind IN ('in', 'out', 'adj')),
  qty        INTEGER,
  note       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movements_batch_idx ON movements (batch_id, created_at);
