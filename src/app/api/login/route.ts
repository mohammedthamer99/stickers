import { NextResponse } from "next/server";
import {
  COOKIE,
  SESSION_DAYS,
  WH_COOKIE,
  authConfigured,
  authenticate,
  makeToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "رموز المخازن مو مضبوطة بإعدادات السيرفر. شوف ملف README." },
      { status: 500 },
    );
  }
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {}

  const warehouse = await authenticate(password);
  if (!warehouse) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "رمز الدخول غلط." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, warehouse: { id: warehouse.id, name: warehouse.name } });
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.cookies.set(COOKIE, await makeToken(warehouse.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  // كوكي غير محمي يقرأه المتصفح ليعرف اسم المخزن وكاشه بدون ما يختلط بمخزن ثاني
  // Next.js يرمّز قيمة الكوكي تلقائياً، فما نرمّزها هنا مرة ثانية
  res.cookies.set(WH_COOKIE, JSON.stringify({ id: warehouse.id, name: warehouse.name }), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
