import { NextResponse } from "next/server";
import {
  EDIT_COOKIE,
  EDIT_MINUTES,
  checkEditCode,
  editConfigured,
  makeEditToken,
  type WarehousePublic,
} from "@/lib/auth";
import { requireWarehouse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!editConfigured()) {
    return NextResponse.json(
      { error: "رمز التعديل مو مضبوط بإعدادات السيرفر. ضيف EDIT_CODE أو APP_PASSWORD." },
      { status: 500 },
    );
  }

  let warehouse: WarehousePublic;
  try {
    warehouse = await requireWarehouse();
  } catch {
    return NextResponse.json({ error: "لازم تسجل دخول." }, { status: 401 });
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {}

  if (!(await checkEditCode(code))) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "الرمز غلط." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(EDIT_COOKIE, await makeEditToken(warehouse.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EDIT_MINUTES * 60,
  });
  return res;
}
