import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";
import { sanitizeProfile } from "../../profile-fields";
import { isAgent } from "../../service-routing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const [{ data: profile }, { data: policies }, { data: files }, { data: requests }] = await Promise.all([
    supabase
      .from("client_profiles")
      .select("id, fullName:full_name, phone, dateOfBirth:date_of_birth, onboardingStatus:onboarding_status, onboardingStep:onboarding_step, profile, createdAt:created_at, updatedAt:updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_policies")
      .select("id, policyNumber:policy_number, policyType:policy_type, carrier, insuredName:insured_name, ownerName:owner_name, deathBenefit:death_benefit, monthlyPremium:monthly_premium, effectiveDate:effective_date, beneficiaries, cashValue:cash_value, sourceFileName:source_file_name, createdAt:created_at, updatedAt:updated_at")
      .eq("user_id", user.id),
    supabase
      .from("documents")
      .select("id, fileName:file_name, contentType:content_type, fileSize:file_size, policyNumber:policy_number, processingStatus:processing_status, createdAt:created_at")
      .eq("user_id", user.id),
    supabase
      .from("service_requests")
      .select("id, requestType:request_type, details, requestDataJson:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at")
      .eq("user_id", user.id),
  ]);

  return Response.json({
    user,
    isAgent: await isAgent(user.email),
    profile,
    policies: policies || [],
    documents: files || [],
    requests: (requests || []).map((request) => ({ ...request, requestDataJson: JSON.stringify(request.requestDataJson || {}) })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as { fullName?: string; phone?: string; dateOfBirth?: string; onboardingStatus?: string; onboardingStep?: number; profile?: Record<string, unknown> };
  const cleanProfile = sanitizeProfile(body.profile);
  const fullName = (body.fullName?.trim() || user.fullName || user.displayName).slice(0, 120);
  const status = ["in_progress", "completed"].includes(body.onboardingStatus || "") ? body.onboardingStatus! : "in_progress";

  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase
    .from("client_profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        phone: body.phone?.trim().slice(0, 30) || "",
        date_of_birth: body.dateOfBirth?.trim().slice(0, 10) || "",
        onboarding_status: status,
        onboarding_step: Math.max(0, Math.min(7, Number(body.onboardingStep) || 0)),
        profile: cleanProfile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id, fullName:full_name, phone, dateOfBirth:date_of_birth, onboardingStatus:onboarding_status, onboardingStep:onboarding_step, profile, createdAt:created_at, updatedAt:updated_at")
    .single();

  if (error) return Response.json({ error: "Unable to save profile" }, { status: 500 });
  return Response.json({ profile });
}
