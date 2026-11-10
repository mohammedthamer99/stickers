import { NextResponse } from "next/server";
import { COOKIE, SESSION_DAYS, authConfigured, checkPassword, makeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "APP_PASSWORD مو مضبوط بإعدادات السيرفر. شوف ملف README." },
      { status: 500 },
    );
  }
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {}

  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "كلمة السر غلط." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
