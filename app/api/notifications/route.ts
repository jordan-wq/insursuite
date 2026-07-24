import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";

const NOTIFICATION_SELECT = "id, type, title, message, read, relatedId:related_id, createdAt:created_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data: notifications } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return Response.json({ notifications: notifications || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as { id?: string; markAllRead?: boolean };
  const supabase = await createServerSupabase();

  if (body.markAllRead) {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    return Response.json({ ok: true });
  }

  if (!body.id) return Response.json({ error: "id or markAllRead is required" }, { status: 400 });
  const { data: notification, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(NOTIFICATION_SELECT)
    .single();

  if (error || !notification) return Response.json({ error: "Notification not found" }, { status: 404 });
  return Response.json({ notification });
}
