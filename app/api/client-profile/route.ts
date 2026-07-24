import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";
import { sanitizeProfile } from "../../profile-fields";
import { isAgent } from "../../service-routing";
import { formatMoney } from "../../lib/money";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, insuredName:insured_name, ownerName:owner_name, deathBenefit:death_benefit, monthlyPremium:monthly_premium, effectiveDate:effective_date, premiumDueDate:premium_due_date, beneficiaries, cashValue:cash_value, sourceFileName:source_file_name, createdAt:created_at, updatedAt:updated_at";

function formatPolicy<T extends { deathBenefit: unknown; monthlyPremium: unknown; cashValue: unknown }>(policy: T) {
  return { ...policy, deathBenefit: formatMoney(policy.deathBenefit as number | null), monthlyPremium: formatMoney(policy.monthlyPremium as number | null), cashValue: formatMoney(policy.cashValue as number | null) };
}

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
    supabase.from("user_policies").select(POLICY_SELECT).eq("user_id", user.id),
    supabase
      .from("documents")
      .select("id, fileName:file_name, contentType:content_type, fileSize:file_size, policyNumber:policy_number, processingStatus:processing_status, createdAt:created_at")
      .eq("user_id", user.id),
    supabase
      .from("service_requests")
      .select("id, requestType:request_type, details, requestDataJson:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at")
      .eq("user_id", user.id),
  ]);

  const dueSoon = (policies || []).filter((p) => {
    if (!p.premiumDueDate) return false;
    const days = Math.ceil((new Date(p.premiumDueDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14;
  });
  for (const policy of dueSoon) {
    const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", user.id).eq("type", "premium_due_soon").eq("related_id", policy.id).eq("read", false).maybeSingle();
    if (!existing) {
      await supabase.from("notifications").insert({ user_id: user.id, type: "premium_due_soon", title: "A premium is due soon", message: `${policy.carrier || "A policy"} premium is due within 14 days.`, related_id: policy.id });
    }
  }

  return Response.json({
    user,
    isAgent: await isAgent(user.id),
    profile,
    policies: (policies || []).map(formatPolicy),
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
        email: user.email,
        full_name: fullName,
        phone: body.phone?.trim().slice(0, 30) || "",
        date_of_birth: body.dateOfBirth?.trim() || null,
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
