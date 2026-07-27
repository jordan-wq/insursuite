import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const DRAFT_SELECT = "id, firstName:first_name, lastName:last_name, email, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: drafts } = await admin
    .from("underwriting_records")
    .select(DRAFT_SELECT)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  return Response.json({ drafts: drafts || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { firstName?: string; lastName?: string; email?: string; phone?: string; dateOfBirth?: string };
  const firstName = (body.firstName || "").trim().slice(0, 120);
  const lastName = (body.lastName || "").trim().slice(0, 120);
  const email = (body.email || "").trim().toLowerCase().slice(0, 255);
  if (!firstName || !lastName || !email) return Response.json({ error: "First name, last name, and email are required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: existing } = await admin.from("client_profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return Response.json({ error: "An account with this email already exists" }, { status: 409 });

  const { data: draft, error } = await admin
    .from("underwriting_records")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: (body.phone || "").trim().slice(0, 30),
      date_of_birth: body.dateOfBirth || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !draft) return Response.json({ error: "Could not start intake" }, { status: 500 });
  return Response.json({ id: draft.id }, { status: 201 });
}
