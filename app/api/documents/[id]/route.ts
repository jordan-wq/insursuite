import { createServerSupabase } from "../../../lib/supabase/server";
import { getCurrentUser } from "../../../auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const params = await context.params;
  if (!UUID_PATTERN.test(params.id)) return Response.json({ error: "Valid document id required" }, { status: 400 });
  const download = new URL(request.url).searchParams.get("download") === "1";

  const supabase = await createServerSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id, storageKey:storage_key, fileName:file_name, contentType:content_type, fileSize:file_size")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const { data: blob, error } = await supabase.storage.from("documents").download(document.storageKey);
  if (error || !blob) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const disposition = `${download ? "attachment" : "inline"}; filename="${document.fileName.replace(/"/g, "")}"`;
  return new Response(blob, {
    headers: {
      "content-type": document.contentType || "application/octet-stream",
      "content-length": String(document.fileSize),
      "content-disposition": disposition,
      "cache-control": "private, max-age=60",
    },
  });
}
