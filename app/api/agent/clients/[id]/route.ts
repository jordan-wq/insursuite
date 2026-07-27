import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";
const REQUEST_SELECT = "id, requestType:request_type, details, status, assignedTo:assigned_to, source, priority, createdAt:created_at, updatedAt:updated_at";
const DOCUMENT_SELECT = "id, fileName:file_name, contentType:content_type, fileSize:file_size, processingStatus:processing_status, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Valid client id required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, fullName:full_name, email, phone, dateOfBirth:date_of_birth, onboardingStatus:onboarding_status, onboardingStep:onboarding_step, profile, createdAt:created_at, updatedAt:updated_at")
    .eq("user_id", id)
    .maybeSingle();
  if (!profile) return Response.json({ error: "Client not found" }, { status: 404 });

  const [{ data: policies }, { data: requests }, { data: documents }] = await Promise.all([
    admin.from("user_policies").select(POLICY_SELECT).eq("user_id", id),
    admin.from("service_requests").select(REQUEST_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
    admin.from("documents").select(DOCUMENT_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
  ]);

  return Response.json({ profile, policies: policies || [], requests: requests || [], documents: documents || [] });
}
