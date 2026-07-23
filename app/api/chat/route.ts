import { createServerSupabase } from "../../lib/supabase/server";
import { createAdminSupabase } from "../../lib/supabase/admin";
import { getCurrentUser } from "../../auth";
import { chooseAgent } from "../../service-routing";

const tokenize = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 2));

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, message, resolution, serviceRequestId:service_request_id, createdAt:created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return Response.json({ messages: (messages || []).reverse() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const supabase = await createServerSupabase();
  await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", message });

  const { data: entries } = await supabase.from("knowledge_entries").select("question, answer, keywords").eq("active", true);
  const query = tokenize(message);
  const ranked = (entries || []).map((entry) => {
    const terms = tokenize(`${entry.question} ${entry.keywords}`);
    const hits = [...query].filter((term) => terms.has(term)).length;
    return { entry, score: hits / Math.max(2, Math.min(query.size, terms.size)) };
  }).sort((a, b) => b.score - a.score);

  let answer = "";
  let resolution = "answered";
  let serviceRequestId: number | null = null;

  if (ranked[0]?.score >= .34) {
    answer = ranked[0].entry.answer;
  } else if (/policy|coverage|premium|benefit|cash value/i.test(message)) {
    const { data: policies } = await supabase.from("user_policies").select("id").eq("user_id", user.id);
    const count = policies?.length || 0;
    answer = count
      ? `I found ${count} saved ${count === 1 ? "policy" : "policies"}. I can explain recorded details, but carrier records control coverage and a licensed representative must confirm recommendations or changes.`
      : "I do not see a saved policy yet. Upload the policy document so I can organize its carrier, benefit, premium, beneficiaries, and cash value.";
  } else {
    const assignedTo = await chooseAgent(user.email);
    const { data: ticket } = await supabase
      .from("service_requests")
      .insert({ user_id: user.id, request_type: "Chatbot escalation", details: message, status: assignedTo ? "assigned" : "new", assigned_to: assignedTo, source: "chatbot", priority: "normal", unread_by_agent: true })
      .select("id")
      .single();
    serviceRequestId = ticket?.id ?? null;
    if (assignedTo && serviceRequestId) {
      const admin = createAdminSupabase();
      await admin.from("agent_notifications").insert({ agent_email: assignedTo, client_email: user.email, service_request_id: serviceRequestId, title: "Chatbot needs human help", message: message.slice(0, 500) });
    }
    resolution = "escalated";
    answer = assignedTo
      ? `I could not complete that reliably, so I created request IS-${1000 + (serviceRequestId || 0)} and assigned it to a customer service representative. They can see your question and will follow up here.`
      : `I could not complete that reliably, so I created request IS-${1000 + (serviceRequestId || 0)}. It is waiting for a customer service representative.`;
  }

  await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", message: answer, resolution, service_request_id: serviceRequestId });
  return Response.json({ answer, resolution, serviceRequestId });
}
