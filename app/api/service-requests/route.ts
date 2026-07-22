import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { agentNotifications, serviceRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { initialRequestStatus, priorityForUrgency, sanitizeServiceRequestData } from "../../service-request-model";
import { chooseAgent } from "../../service-routing";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const db = await getDb();
  const requests = await db.select().from(serviceRequests).where(eq(serviceRequests.userEmail, user.email)).orderBy(desc(serviceRequests.createdAt));
  return Response.json({ requests });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { requestType?: string; details?: string; requestData?: Record<string, unknown> };
  if (!body.requestType?.trim()) return Response.json({ error: "Request type is required" }, { status: 400 });
  const requestType = body.requestType.trim().slice(0, 120);
  const details = (body.details || "").trim().slice(0, 4000);
  const requestData = sanitizeServiceRequestData(body.requestData);
  const assignedTo = await chooseAgent(user.email);
  const db = await getDb();
  const priority = priorityForUrgency(requestData.urgency);
  const [saved] = await db.insert(serviceRequests).values({ userEmail: user.email, requestType, details, requestDataJson: JSON.stringify(requestData), status: initialRequestStatus(assignedTo), assignedTo, source: "client", priority, unreadByAgent: true }).returning();
  if (assignedTo) await db.insert(agentNotifications).values({ agentEmail: assignedTo, clientEmail: user.email, serviceRequestId: saved.id, title: `New ${requestType} request`, message: details.slice(0, 500) });
  return Response.json({ request: saved }, { status: 201 });
}
