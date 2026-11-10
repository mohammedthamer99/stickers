import { dispense } from "@/lib/inventory";
import { parseId, readJson, run } from "@/lib/http";
import { parseDispense } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return run(async () => {
    const id = parseId(params.id);
    const { qty, note } = parseDispense(await readJson(req));
    return { batch: await dispense(id, qty, note) };
  });
}
