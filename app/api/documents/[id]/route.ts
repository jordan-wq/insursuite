import { createServerSupabase } from "../../../lib/supabase/server";
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_SELECT = "id, storageKey:storage_key, fileName:file_name, contentType:content_type, fileSize:file_size";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const params = await context.params;
  if (!UUID_PATTERN.test(params.id)) return Response.json({ error: "Valid document id required" }, { status: 400 });
  const download = new URL(request.url).searchParams.get("download") === "1";

  const supabase = await createServerSupabase();
  let document = (
    await supabase.from("documents").select(DOCUMENT_SELECT).eq("id", params.id).eq("user_id", user.id).maybeSingle()
  ).data;
  let storage = supabase.storage;

  if (!document && (await isAgent(user.id))) {
    const admin = createAdminSupabase();
    document = (await admin.from("documents").select(DOCUMENT_SELECT).eq("id", params.id).maybeSingle()).data;
    storage = admin.storage;
  }
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const { data: blob, error } = await storage.from("documents").download(document.storageKey);
  if (error || !blob) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const safeFileName = document.fileName.replace(/[\x00-\x1f\x7f"]/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${safeFileName}"`;
  return new Response(blob, {
    headers: {
      "content-type": document.contentType || "application/octet-stream",
      "content-length": String(document.fileSize),
      "content-disposition": disposition,
      "cache-control": "private, max-age=60",
    },
  });
}
