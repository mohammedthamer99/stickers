import { listBatches, receive } from "@/lib/inventory";
import { readJson, run } from "@/lib/http";
import { parseBatchInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => ({ items: await listBatches() }));
}

export async function POST(req: Request) {
  return run(async () => {
    const input = parseBatchInput(await readJson(req));
    return receive(input);
  });
}
