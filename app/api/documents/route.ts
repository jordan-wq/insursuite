import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";

const DOCUMENT_SELECT = "id, fileName:file_name, contentType:content_type, fileSize:file_size, policyNumber:policy_number, processingStatus:processing_status, createdAt:created_at";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const policyNumber = String(form.get("policyNumber") || "").trim().slice(0, 40);
  if (!(file instanceof File)) return Response.json({ error: "File is required" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "File must be 20 MB or smaller" }, { status: 400 });
  const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, PNG, JPG, and text policy documents are supported" }, { status: 415 });

  const supabase = await createServerSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(storageKey, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return Response.json({ error: "Document storage is unavailable" }, { status: 503 });

  let policyId: string | null = null;
  if (policyNumber) {
    const { data: policy } = await supabase.from("user_policies").select("id").eq("user_id", user.id).eq("policy_number", policyNumber).maybeSingle();
    policyId = policy?.id ?? null;
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      policy_id: policyId,
      storage_key: storageKey,
      file_name: file.name.slice(0, 240),
      content_type: file.type,
      file_size: file.size,
      policy_number: policyNumber,
      processing_status: "processed",
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (error) {
    await supabase.storage.from("documents").remove([storageKey]);
    return Response.json({ error: "Unable to save document" }, { status: 500 });
  }

  return Response.json({ document }, { status: 201 });
}
