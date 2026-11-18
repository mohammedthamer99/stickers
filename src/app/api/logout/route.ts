import { NextResponse } from "next/server";
import { COOKIE, EDIT_COOKIE, WH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(EDIT_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(WH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
