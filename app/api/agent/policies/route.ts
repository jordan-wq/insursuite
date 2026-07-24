import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return Response.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: policies } = await admin.from("user_policies").select(POLICY_SELECT).eq("user_id", clientId);
  return Response.json({ policies: policies || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; packetStatus?: string };
  if (!body.id || !["not_sent", "sent", "delivered"].includes(body.packetStatus || "")) {
    return Response.json({ error: "Valid policy id and status required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: policy, error } = await admin
    .from("user_policies")
    .update({ packet_status: body.packetStatus })
    .eq("id", body.id)
    .select("id, userId:user_id, packetStatus:packet_status")
    .single();

  if (error || !policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  if (body.packetStatus === "delivered") {
    await admin.from("notifications").insert({
      user_id: policy.userId,
      type: "packet_delivered",
      title: "Your policy packet has been delivered",
      message: "Your policy documents are on their way or have arrived — check your mailbox.",
      related_id: policy.id,
    });
  }

  return Response.json({ policy });
}
