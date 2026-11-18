import { cookies } from "next/headers";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/auth";
import { removeBatch, updateBatch } from "@/lib/inventory";
import { ApiError, parseId, readJson, run } from "@/lib/http";
import { requireWarehouse } from "@/lib/session";
import { parseBatchInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  return run(async () => {
    const warehouse = await requireWarehouse();
    const editWarehouse = await verifyEditToken(cookies().get(EDIT_COOKIE)?.value);
    if (editWarehouse !== warehouse.id) {
      throw new ApiError(403, "هذا التعديل يحتاج رمز التعديل. اضغط تعديل وأدخل الرمز.");
    }
    const id = parseId(params.id);
    const input = parseBatchInput(await readJson(req));
    return { batch: await updateBatch(warehouse.id, id, input) };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return run(async () => {
    const warehouse = await requireWarehouse();
    await removeBatch(warehouse.id, parseId(params.id));
    return { ok: true };
  });
}
