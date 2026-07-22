import { getDb } from "../../../db";
import { documents } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isVercelDemoStore, vercelSaveDocument } from "../../vercel-demo-store";

export function publicDocument(document: typeof documents.$inferSelect) {
  return {
    id: document.id,
    fileName: document.fileName,
    contentType: document.contentType,
    fileSize: document.fileSize,
    policyNumber: document.policyNumber,
    processingStatus: document.processingStatus,
    createdAt: document.createdAt,
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const form = await request.formData();
  if (isVercelDemoStore()) return vercelSaveDocument(user, form);
  const file = form.get("file");
  const policyNumber = String(form.get("policyNumber") || "");
  if (!(file instanceof File)) return Response.json({ error: "File is required" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "File must be 20 MB or smaller" }, { status: 400 });
  const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, PNG, JPG, and text policy documents are supported" }, { status: 415 });
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) return Response.json({ error: "Document storage is unavailable" }, { status: 503 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${encodeURIComponent(user.email)}/${crypto.randomUUID()}-${safeName}`;
  await env.BUCKET.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  const db = await getDb();
  const [document] = await db.insert(documents).values({ userEmail: user.email, storageKey, fileName: file.name.slice(0, 240), contentType: file.type, fileSize: file.size, policyNumber: policyNumber.trim().slice(0, 40), processingStatus: "processed" }).returning();
  return Response.json({ document: publicDocument(document) }, { status: 201 });
}
