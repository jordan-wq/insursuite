import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

const RECORD_SELECT = "id, userId:user_id, status, firstName:first_name, lastName:last_name, email, phone, dateOfBirth:date_of_birth, address, city, state, postalCode:postal_code, underwriting, policyDraft:policy_draft, createdAt:created_at, updatedAt:updated_at";

const UNDERWRITING_KEYS = ["heightWeight", "tobaccoUse", "majorConditions", "currentMedications", "familyHealthHistory", "recentHospitalizations", "occupation", "hazardousHobbies", "drivingRecord", "foreignTravel", "alcoholSubstanceUse", "annualIncome", "netWorth", "existingCoverage", "coveragePurpose", "primaryBeneficiaryName", "primaryBeneficiaryRelationship", "primaryBeneficiaryPercentage", "contingentBeneficiaryName", "contingentBeneficiaryRelationship", "contingentBeneficiaryPercentage", "missingDocuments", "underwritingNotes", "recommendedNextStep"];

const POLICY_DRAFT_KEYS = ["policyNumber", "policyType", "carrier", "insuredName", "ownerName", "deathBenefit", "monthlyPremium", "effectiveDate", "beneficiaries", "cashValue"];

function sanitizeJsonbFields(input: Record<string, unknown>, allowedKeys: string[]): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const key of allowedKeys) {
    const value = input[key];
    if (typeof value === "string") result[key] = value.trim().slice(0, 2000);
    else if (typeof value === "number") result[key] = value;
  }
  return result;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: record } = await admin.from("underwriting_records").select(RECORD_SELECT).eq("id", id).maybeSingle();
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ record });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: existing } = await admin.from("underwriting_records").select("status").eq("id", id).maybeSingle();
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "completed") return Response.json({ error: "This intake is already completed and cannot be edited" }, { status: 400 });

  const body = await request.json() as {
    firstName?: string; lastName?: string; email?: string; phone?: string; dateOfBirth?: string;
    address?: string; city?: string; state?: string; postalCode?: string;
    underwriting?: Record<string, string | number>; policyDraft?: Record<string, string | number>;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.firstName !== undefined) update.first_name = body.firstName.trim().slice(0, 120);
  if (body.lastName !== undefined) update.last_name = body.lastName.trim().slice(0, 120);
  if (body.email !== undefined) update.email = body.email.trim().toLowerCase().slice(0, 255);
  if (body.phone !== undefined) update.phone = body.phone.trim().slice(0, 30);
  if (body.dateOfBirth !== undefined) update.date_of_birth = body.dateOfBirth || null;
  if (body.address !== undefined) update.address = body.address.trim().slice(0, 200);
  if (body.city !== undefined) update.city = body.city.trim().slice(0, 200);
  if (body.state !== undefined) update.state = body.state.trim().slice(0, 200);
  if (body.postalCode !== undefined) update.postal_code = body.postalCode.trim().slice(0, 200);
  if (body.underwriting !== undefined) update.underwriting = sanitizeJsonbFields(body.underwriting, UNDERWRITING_KEYS);
  if (body.policyDraft !== undefined) update.policy_draft = sanitizeJsonbFields(body.policyDraft, POLICY_DRAFT_KEYS);

  const { data: record, error } = await admin.from("underwriting_records").update(update).eq("id", id).select(RECORD_SELECT).single();
  if (error || !record) return Response.json({ error: "Could not save" }, { status: 500 });
  return Response.json({ record });
}
