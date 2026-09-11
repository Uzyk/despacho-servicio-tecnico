import { readSharedState, writeSharedState } from "@/lib/sync-server";
import type { AppData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: AppData | null, status = 200) {
  return Response.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function GET() {
  try {
    return json(await readSharedState());
  } catch {
    return json(null, 503);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as AppData;
    if (!body || !Array.isArray(body.routes) || !Array.isArray(body.assignments)) {
      return json(null, 400);
    }
    return json(await writeSharedState(body));
  } catch {
    return json(null, 503);
  }
}
