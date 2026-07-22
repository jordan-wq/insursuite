import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { agentNotifications, clientProfiles, serviceRequests } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isAgentEditableRequestStatus } from "../../../service-request-model";
import { isAgent } from "../../../service-routing";
import { isVercelDemoStore, vercelAgentQueue, vercelUpdateAgentRequest } from "../../../vercel-demo-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });
  if (isVercelDemoStore()) return vercelAgentQueue(user);
  const db = await getDb();
  const requests = await db.select().from(serviceRequests).where(eq(serviceRequests.assignedTo, user.email.toLowerCase())).orderBy(desc(serviceRequests.createdAt));
  const notifications = await db.select().from(agentNotifications).where(eq(agentNotifications.agentEmail, user.email.toLowerCase())).orderBy(desc(agentNotifications.createdAt)).limit(30);
  const clients = await db.select().from(clientProfiles);
  return Response.json({ requests: requests.map((item) => ({ ...item, requestData: JSON.parse(item.requestDataJson || "{}"), clientName: clients.find((client) => client.userEmail === item.userEmail)?.fullName || item.userEmail })), notifications });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });
  const body = await request.json() as { id?: number; status?: string };
  if (!body.id || !isAgentEditableRequestStatus(body.status)) return Response.json({ error: "Valid request and status required" }, { status: 400 });
  if (isVercelDemoStore()) return vercelUpdateAgentRequest(user, body);
  const db = await getDb();
  const [saved] = await db.update(serviceRequests).set({ status: body.status, unreadByAgent: false, updatedAt: new Date().toISOString() }).where(and(eq(serviceRequests.id, body.id), eq(serviceRequests.assignedTo, user.email.toLowerCase()))).returning();
  if (!saved) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });
  return Response.json({ request: saved });
}
