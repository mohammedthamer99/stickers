// يشتغل بالـ Edge (middleware) وبالـ Node (API) لأنه يعتمد على Web Crypto فقط.

export const COOKIE = "stk_session";
export const SESSION_DAYS = 30;

export const EDIT_COOKIE = "stk_edit";
export const EDIT_MINUTES = 15;

const enc = new TextEncoder();

function secret(): string {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || "";
}

function editSecret(): string {
  return `${secret()}:edit`;
}

function editCode(): string {
  return process.env.EDIT_CODE || process.env.APP_PASSWORD || "";
}

export function authConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function editConfigured(): boolean {
  return Boolean(process.env.EDIT_CODE || process.env.APP_PASSWORD);
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

export async function makeToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // نقارن البصمات حتى يكون زمن المقارنة ثابت
  const [a, b] = await Promise.all([hmac(`pw:${input}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}

export async function makeEditToken(): Promise<string> {
  const exp = String(Date.now() + EDIT_MINUTES * 60 * 1000);
  return `${exp}.${await hmacWith(editSecret(), `edit:${exp}`)}`;
}

export async function verifyEditToken(token: string | undefined): Promise<boolean> {
  if (!token || !editConfigured()) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmacWith(editSecret(), `edit:${exp}`));
}

export async function checkEditCode(input: string): Promise<boolean> {
  const expected = editCode();
  if (!expected) return false;
  const [a, b] = await Promise.all([
    hmacWith(editSecret(), `ec:${input}`),
    hmacWith(editSecret(), `ec:${expected}`),
  ]);
  return safeEqual(a, b);
}
