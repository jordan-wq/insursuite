import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: roles } = await admin.from("agent_roles").select("userId:user_id, createdAt:created_at").order("created_at", { ascending: true });
  if (!roles?.length) return Response.json({ staff: [] });

  const { data: profiles } = await admin.from("client_profiles").select("userId:user_id, email").in("user_id", roles.map((r) => r.userId));
  const staff = roles.map((role) => ({ userId: role.userId, createdAt: role.createdAt, email: profiles?.find((p) => p.userId === role.userId)?.email || "(no profile)" }));
  return Response.json({ staff });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("client_profiles").select("userId:user_id").eq("email", email).maybeSingle();
  if (!profile) return Response.json({ error: "No account found for that email — they need to sign up first" }, { status: 404 });

  const { error } = await admin.from("agent_roles").insert({ user_id: profile.userId });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "That person already has staff access" }, { status: 409 });
    return Response.json({ error: "Unable to grant access" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
