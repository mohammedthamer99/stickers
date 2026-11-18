import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { listBatches } from "@/lib/inventory";
import { ApiError } from "@/lib/http";
import { requireWarehouse } from "@/lib/session";

export const dynamic = "force-dynamic";

const SOON = 90;

function daysLeft(expiry: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!m) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Math.round((d.getTime() - today.getTime()) / 864e5);
}

function statusLabel(remaining: number, expiry: string): string {
  if (remaining === 0) return "خالصة";
  const left = daysLeft(expiry);
  if (left !== null && left < 0) return "منتهية";
  if (left !== null && left <= SOON) return "قريبة الانتهاء";
  return "سليم";
}

const HEAD = [
  "اسم المادة",
  "الباج نمبر",
  "تاريخ الانتهاء",
  "الكمية",
  "المصروف",
  "المتبقي",
  "مكان التخزين",
  "الحالة",
  "الأيام للانتهاء",
];

export async function GET(req: Request) {
  try {
    const warehouse = await requireWarehouse();
    const params = new URL(req.url).searchParams;
    const name = params.get("name")?.trim() ?? "";
    const idsRaw = params.get("ids")?.trim() ?? "";

    let ids: Set<number> | null = null;
    if (idsRaw) {
      const parts = idsRaw.split(",").map((s) => Number(s.trim()));
      if (parts.length === 0 || parts.some((n) => !Number.isInteger(n) || n < 1)) {
        throw new ApiError(400, "اختيار الدفعات غير صحيح.");
      }
      ids = new Set(parts);
    }

    let rows = await listBatches(warehouse.id);
    if (ids) rows = rows.filter((b) => ids!.has(b.id));
    if (name) rows = rows.filter((b) => b.name.toLowerCase() === name.toLowerCase());
    if ((ids || name) && rows.length === 0) {
      throw new ApiError(404, "ماكو دفعات مطابقة للاختيار.");
    }

    const body: (string | number | null)[][] = [HEAD];
    let totalReceived = 0;
    let totalDispensed = 0;
    let totalRemaining = 0;

    for (const b of rows) {
      const remaining = Math.max(0, b.received - b.dispensed);
      totalReceived += b.received;
      totalDispensed += b.dispensed;
      totalRemaining += remaining;
      body.push([
        b.name,
        b.batch,
        b.expiry,
        b.received,
        b.dispensed,
        remaining,
        b.location || "غير محدد",
        statusLabel(remaining, b.expiry),
        daysLeft(b.expiry),
      ]);
    }

    body.push([]);
    body.push(["المجموع", "", "", totalReceived, totalDispensed, totalRemaining, "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(body);
    ws["!cols"] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
    ];

    const uniqNames = Array.from(new Set(rows.map((b) => b.name)));
    const label = uniqNames.length === 1 ? uniqNames[0] : "المخزون";

    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, `${warehouse.name} - ${label}`.slice(0, 31));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const stamp = new Date().toISOString().slice(0, 10);
    const file = `كشف-${warehouse.name}-${label}-${stamp}.xlsx`;

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventory-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(file)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "تعذر إنشاء ملف Excel. جرّب مرة ثانية." }, { status: 500 });
  }
}
