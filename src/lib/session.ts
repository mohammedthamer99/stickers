import { cookies } from "next/headers";
import { COOKIE, verifyToken, warehouseById, type WarehousePublic } from "./auth";
import { ApiError } from "./http";

/** يرجع المخزن الحالي من جلسة الدخول، أو يرفض الطلب. */
export async function requireWarehouse(): Promise<WarehousePublic> {
  const wid = await verifyToken(cookies().get(COOKIE)?.value);
  const w = wid ? warehouseById(wid) : undefined;
  if (!w) throw new ApiError(401, "لازم تسجل دخول.");
  return { id: w.id, name: w.name };
}
