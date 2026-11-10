import { ApiError } from "./http";

export type BatchInput = {
  name: string;
  batch: string;
  expiry: string;
  location: string;
  received: number;
  dispensed: number;
};

const MAX_QTY = 10_000_000;

function text(v: unknown, label: string, max: number, required: boolean): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new ApiError(400, `اكتب ${label}.`);
  if (s.length > max) throw new ApiError(400, `${label} طويل مرة (الحد ${max} حرف).`);
  return s;
}

function int(v: unknown, label: string, min: number): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > MAX_QTY) {
    throw new ApiError(400, `${label} لازم يكون رقم صحيح${min > 0 ? " أكبر من صفر" : ""}.`);
  }
  return n;
}

export function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseBatchInput(b: Record<string, unknown>): BatchInput {
  const name = text(b.name, "اسم المادة", 120, true);
  const batch = text(b.batch, "الباج نمبر", 60, true);
  const expiry = typeof b.expiry === "string" ? b.expiry : "";
  if (!isRealDate(expiry)) throw new ApiError(400, "اختار تاريخ انتهاء صحيح.");
  const location = text(b.location, "مكان التخزين", 60, false);
  const received = int(b.received, "الكمية", 1);
  const dispensed =
    b.dispensed === undefined || b.dispensed === null || b.dispensed === ""
      ? 0
      : int(b.dispensed, "المصروف", 0);
  if (dispensed > received) throw new ApiError(400, "المصروف أكبر من الكمية.");
  return { name, batch, expiry, location, received, dispensed };
}

export function parseDispense(b: Record<string, unknown>): { qty: number; note: string } {
  return {
    qty: int(b.qty, "الكمية", 1),
    note: text(b.note, "الملاحظة", 120, false),
  };
}
