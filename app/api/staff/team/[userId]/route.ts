import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { userId } = await context.params;
  if (userId === user.id) return Response.json({ error: "You cannot revoke your own access" }, { status: 400 });

  const admin = createAdminSupabase();
  await admin.from("agent_roles").delete().eq("user_id", userId);
  return Response.json({ ok: true });
}
