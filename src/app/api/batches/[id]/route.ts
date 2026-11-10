import { removeBatch, updateBatch } from "@/lib/inventory";
import { parseId, readJson, run } from "@/lib/http";
import { parseBatchInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  return run(async () => {
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
