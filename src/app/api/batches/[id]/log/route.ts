import { batchLog } from "@/lib/inventory";
import { parseId, run } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return run(async () => ({ log: await batchLog(parseId(params.id)) }));
}
