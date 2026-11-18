import { batchLog } from "@/lib/inventory";
import { parseId, run } from "@/lib/http";
import { requireWarehouse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return run(async () => {
    const warehouse = await requireWarehouse();
    return { log: await batchLog(warehouse.id, parseId(params.id)) };
  });
}
