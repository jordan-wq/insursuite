import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { documents } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Valid document id required" }, { status: 400 });

  const db = await getDb();
  const [document] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userEmail, user.email))).limit(1);
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) return Response.json({ error: "Document storage is unavailable" }, { status: 503 });

  const object = await env.BUCKET.get(document.storageKey);
  if (!object?.body) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = `${download ? "attachment" : "inline"}; filename="${document.fileName.replace(/"/g, "")}"`;
  return new Response(object.body, {
    headers: {
      "content-type": document.contentType || "application/octet-stream",
      "content-length": String(document.fileSize),
      "content-disposition": disposition,
      "cache-control": "private, max-age=60",
    },
  });
}
