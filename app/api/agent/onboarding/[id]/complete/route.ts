import { createAdminSupabase } from "../../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../../auth";
import { isAgent } from "../../../../../service-routing";
import { sanitizeProfile } from "../../../../../profile-fields";
import { parseMoney, parseDate } from "../../../../../lib/money";

type PolicyDraft = { policyNumber?: string; policyType?: string; carrier?: string; insuredName?: string; ownerName?: string; deathBenefit?: string; monthlyPremium?: string; effectiveDate?: string; beneficiaries?: string; cashValue?: string };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: draft } = await admin.from("underwriting_records").select("*").eq("id", id).maybeSingle();
  if (!draft) return Response.json({ error: "Not found" }, { status: 404 });
  if (draft.status === "completed") return Response.json({ error: "This intake has already been completed" }, { status: 400 });
  if (!draft.first_name || !draft.last_name || !draft.email) return Response.json({ error: "First name, last name, and email are required to complete" }, { status: 400 });

  const email = (draft.email || "").toLowerCase();

  const { data: existing } = await admin.from("client_profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return Response.json({ error: "An account with this email already exists" }, { status: 409 });

  const origin = new URL(request.url).origin;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?return_to=/`,
  });
  if (inviteError || !invited?.user) return Response.json({ error: inviteError?.message || "Could not send invite" }, { status: 500 });

  const newUserId = invited.user.id;
  const policy = (draft.policy_draft || {}) as PolicyDraft;

  const { error: profileError } = await admin.from("client_profiles").insert({
    user_id: newUserId,
    email,
    full_name: `${draft.first_name} ${draft.last_name}`.trim(),
    phone: draft.phone || "",
    date_of_birth: draft.date_of_birth || null,
    onboarding_status: "completed",
    onboarding_step: 0,
    profile: sanitizeProfile({ address: draft.address, city: draft.city, state: draft.state, postalCode: draft.postal_code }),
  });
  if (profileError) return Response.json({ error: "Invite sent, but could not create the client profile — check the Supabase dashboard for the new auth user and finish setup manually." }, { status: 500 });

  const { error: policyError } = await admin.from("user_policies").insert({
    user_id: newUserId,
    policy_number: policy.policyNumber || "",
    policy_type: policy.policyType || "",
    carrier: policy.carrier || "",
    insured_name: policy.insuredName || "",
    owner_name: policy.ownerName || "",
    death_benefit: parseMoney(policy.deathBenefit),
    monthly_premium: parseMoney(policy.monthlyPremium),
    effective_date: parseDate(policy.effectiveDate),
    beneficiaries: policy.beneficiaries || "",
    cash_value: parseMoney(policy.cashValue),
  });
  if (policyError) return Response.json({ error: "Invite sent and profile created, but the policy could not be saved — add it manually from the client's policy page." }, { status: 500 });

  const { data: completed, error: completeError } = await admin
    .from("underwriting_records")
    .update({ status: "completed", user_id: newUserId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id, userId:user_id, status")
    .single();
  if (completeError || !completed) return Response.json({ error: "Invite and account created, but could not mark the intake completed — check the Supabase dashboard." }, { status: 500 });

  return Response.json({ record: completed });
}
