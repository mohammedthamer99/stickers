import { cookies } from "next/headers";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/auth";
import { removeBatch, updateBatch } from "@/lib/inventory";
import { ApiError, parseId, readJson, run } from "@/lib/http";
import { parseBatchInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  return run(async () => {
    if (!(await verifyEditToken(cookies().get(EDIT_COOKIE)?.value))) {
      throw new ApiError(403, "هذا التعديل يحتاج رمز التعديل. اضغط تعديل وأدخل الرمز.");
    }
    const id = parseId(params.id);
    const input = parseBatchInput(await readJson(req));
    return { batch: await updateBatch(id, input) };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return run(async () => {
    await removeBatch(parseId(params.id));
    return { ok: true };
  });
}
