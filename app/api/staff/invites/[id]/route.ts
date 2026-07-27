import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  await admin.from("staff_invites").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  return Response.json({ ok: true });
}
