// يشتغل بالـ Edge (middleware) وبالـ Node (API) لأنه يعتمد على Web Crypto فقط.

export const COOKIE = "stk_session";
export const WH_COOKIE = "stk_wh";
export const SESSION_DAYS = 30;

export const EDIT_COOKIE = "stk_edit";
export const EDIT_MINUTES = 15;

export type Warehouse = { id: number; name: string; code: string };
export type WarehousePublic = { id: number; name: string };

const enc = new TextEncoder();
const MAX_WAREHOUSES = 5;

/** يقرأ المخازن من الإعدادات: WAREHOUSE_1_NAME / WAREHOUSE_1_CODE ... */
export function allWarehouses(): Warehouse[] {
  const list: Warehouse[] = [];
  for (let i = 1; i <= MAX_WAREHOUSES; i++) {
    const rawCode = process.env[`WAREHOUSE_${i}_CODE`];
    // أول مخزن يقبل APP_PASSWORD كتوافق مع الإعداد القديم
    const code = i === 1 && !rawCode ? process.env.APP_PASSWORD || "" : rawCode || "";
    if (!normalize(code)) continue;
    const fallbackName = i === 1 ? "آفاق" : i === 2 ? "تبوك" : `مخزن ${i}`;
    list.push({ id: i, name: process.env[`WAREHOUSE_${i}_NAME`]?.trim() || fallbackName, code });
  }
  return list;
}

export function warehouseById(id: number): Warehouse | undefined {
  return allWarehouses().find((w) => w.id === id);
}

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.APP_PASSWORD ||
    allWarehouses()
      .map((w) => w.code)
      .join("|")
  );
}

function editSecret(): string {
  return `${secret()}:edit`;
}

function editCode(): string {
  return process.env.EDIT_CODE || process.env.APP_PASSWORD || allWarehouses()[0]?.code || "";
}

export function authConfigured(): boolean {
  return allWarehouses().length > 0;
}

export function editConfigured(): boolean {
  return Boolean(editCode());
}

function normalize(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

async function hmacWith(keyText: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(message: string): Promise<string> {
  return hmacWith(secret(), message);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeToken(warehouseId: number): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${warehouseId}.${exp}.${await hmac(`${warehouseId}:${exp}`)}`;
}

/** يرجع رقم المخزن إذا الجلسة صحيحة، أو null. */
export async function verifyToken(token: string | undefined): Promise<number | null> {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [widRaw, exp, sig] = parts;
  if (!/^\d+$/.test(widRaw) || !/^\d+$/.test(exp)) return null;
  const wid = Number(widRaw);
  if (!warehouseById(wid) || Number(exp) < Date.now()) return null;
  return safeEqual(sig, await hmac(`${wid}:${exp}`)) ? wid : null;
}

/** يطابق رمز الدخول مع مخزن ويرجع المخزن، أو null إذا الرمز غلط. */
export async function authenticate(input: string): Promise<Warehouse | null> {
  const list = allWarehouses();
  if (!list.length) return null;
  const key = normalize(input);
  let matched: Warehouse | null = null;
  for (const w of list) {
    const [a, b] = await Promise.all([hmac(`pw:${key}`), hmac(`pw:${normalize(w.code)}`)]);
    if (safeEqual(a, b) && !matched) matched = w;
  }
  return matched;
}

export async function makeEditToken(warehouseId: number): Promise<string> {
  const exp = String(Date.now() + EDIT_MINUTES * 60 * 1000);
  return `${warehouseId}.${exp}.${await hmacWith(editSecret(), `edit:${warehouseId}:${exp}`)}`;
}

/** يرجع رقم المخزن إذا رمز التعديل صحيح لنفس المخزن، أو null. */
export async function verifyEditToken(token: string | undefined): Promise<number | null> {
  if (!token || !editConfigured()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [widRaw, exp, sig] = parts;
  if (!/^\d+$/.test(widRaw) || !/^\d+$/.test(exp)) return null;
  const wid = Number(widRaw);
  if (!warehouseById(wid) || Number(exp) < Date.now()) return null;
  const expected = await hmacWith(editSecret(), `edit:${wid}:${exp}`);
  return safeEqual(sig, expected) ? wid : null;
}

export async function checkEditCode(input: string): Promise<boolean> {
  const expected = editCode();
  if (!expected) return false;
  const [a, b] = await Promise.all([
    hmacWith(editSecret(), `ec:${normalize(input)}`),
    hmacWith(editSecret(), `ec:${normalize(expected)}`),
  ]);
  return safeEqual(a, b);
}
