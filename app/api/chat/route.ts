import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { agentNotifications, chatMessages, knowledgeEntries, serviceRequests, userPolicies } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { chooseAgent } from "../../service-routing";
import { isVercelDemoStore, vercelChatHistory, vercelChatReply } from "../../vercel-demo-store";

const tokenize = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 2));

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (isVercelDemoStore()) return vercelChatHistory(user);
  const db = await getDb();
  const messages = await db.select().from(chatMessages).where(eq(chatMessages.userEmail, user.email)).orderBy(desc(chatMessages.createdAt)).limit(30);
  return Response.json({ messages: messages.reverse() });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });
  if (isVercelDemoStore()) return vercelChatReply(user, message);
  const db = await getDb();
  await db.insert(chatMessages).values({ userEmail: user.email, role: "user", message });
  const entries = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.active, true));
  const query = tokenize(message);
  const ranked = entries.map((entry) => {
    const terms = tokenize(`${entry.question} ${entry.keywords}`);
    const hits = [...query].filter((term) => terms.has(term)).length;
    return { entry, score: hits / Math.max(2, Math.min(query.size, terms.size)) };
  }).sort((a, b) => b.score - a.score);
  let answer = "";
  let resolution = "answered";
  let serviceRequestId: number | null = null;
  if (ranked[0]?.score >= .34) answer = ranked[0].entry.answer;
  else if (/policy|coverage|premium|benefit|cash value/i.test(message)) {
    const policies = await db.select().from(userPolicies).where(eq(userPolicies.userEmail, user.email));
    answer = policies.length ? `I found ${policies.length} saved ${policies.length === 1 ? "policy" : "policies"}. I can explain recorded details, but carrier records control coverage and a licensed representative must confirm recommendations or changes.` : "I do not see a saved policy yet. Upload the policy document so I can organize its carrier, benefit, premium, beneficiaries, and cash value.";
  } else {
    const assignedTo = await chooseAgent(user.email);
    const [ticket] = await db.insert(serviceRequests).values({ userEmail: user.email, requestType: "Chatbot escalation", details: message, status: assignedTo ? "assigned" : "new", assignedTo, source: "chatbot", priority: "normal", unreadByAgent: true }).returning();
    serviceRequestId = ticket.id;
    if (assignedTo) await db.insert(agentNotifications).values({ agentEmail: assignedTo, clientEmail: user.email, serviceRequestId: ticket.id, title: "Chatbot needs human help", message: message.slice(0, 500) });
    resolution = "escalated";
    answer = assignedTo ? `I could not complete that reliably, so I created request IS-${1000 + ticket.id} and assigned it to a customer service representative. They can see your question and will follow up here.` : `I could not complete that reliably, so I created request IS-${1000 + ticket.id}. It is waiting for a customer service representative.`;
  }
  await db.insert(chatMessages).values({ userEmail: user.email, role: "assistant", message: answer, resolution, serviceRequestId });
  return Response.json({ answer, resolution, serviceRequestId });
}
