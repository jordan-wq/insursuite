import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, insuredName:insured_name, ownerName:owner_name, deathBenefit:death_benefit, monthlyPremium:monthly_premium, effectiveDate:effective_date, beneficiaries, cashValue:cash_value, sourceFileName:source_file_name, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data: policies } = await supabase
    .from("user_policies")
    .select(POLICY_SELECT)
    .eq("user_id", user.id);

  return Response.json({ policies: policies || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as Record<string, string>;
  const clean = (value: string | undefined, max = 160) => (value || "").trim().slice(0, max);
  const policyNumber = clean(body.policyNumber, 40);
  if (!policyNumber) return Response.json({ error: "Policy number is required" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: policy, error } = await supabase
    .from("user_policies")
    .upsert(
      {
        user_id: user.id,
        policy_number: policyNumber,
        policy_type: clean(body.policyType),
        carrier: clean(body.carrier),
        insured_name: clean(body.insuredName),
        owner_name: clean(body.ownerName),
        death_benefit: clean(body.deathBenefit, 40),
        monthly_premium: clean(body.monthlyPremium, 40),
        effective_date: clean(body.effectiveDate, 40),
        beneficiaries: clean(body.beneficiaries, 800),
        cash_value: clean(body.cashValue, 40),
        source_file_name: clean(body.sourceFileName, 240),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,policy_number" },
    )
    .select(POLICY_SELECT)
    .single();

  if (error) return Response.json({ error: "Unable to save policy" }, { status: 500 });
  return Response.json({ policy }, { status: 201 });
}
