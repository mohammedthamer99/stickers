import { listBatches, receive } from "@/lib/inventory";
import { readJson, run } from "@/lib/http";
import { requireWarehouse } from "@/lib/session";
import { parseBatchInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const warehouse = await requireWarehouse();
    return { items: await listBatches(warehouse.id) };
  });
}

export async function POST(req: Request) {
  return run(async () => {
    const warehouse = await requireWarehouse();
    const input = parseBatchInput(await readJson(req));
    return receive(warehouse.id, input);
  });
}
