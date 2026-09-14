import { getPool } from "@/lib/postgres";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (process.env.CATALOG_STORAGE === "postgres")
      await getPool().query("SELECT 1 FROM metadata WHERE id=1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
