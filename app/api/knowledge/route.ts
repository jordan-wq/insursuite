import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { knowledgeEntries } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isAgent } from "../../service-routing";
import { isVercelDemoStore, vercelCreateKnowledge, vercelKnowledgeEntries } from "../../vercel-demo-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });
  if (isVercelDemoStore()) return vercelKnowledgeEntries();
  const db = await getDb();
  return Response.json({ entries: await db.select().from(knowledgeEntries).orderBy(desc(knowledgeEntries.updatedAt)) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });
  const body = await request.json() as { question?: string; answer?: string; keywords?: string };
  if (isVercelDemoStore()) return vercelCreateKnowledge(user, body);
  const question = (body.question || "").trim().slice(0, 500);
  const answer = (body.answer || "").trim().slice(0, 5000);
  const keywords = (body.keywords || "").trim().slice(0, 1000);
  if (!question || !answer) return Response.json({ error: "Question and answer are required" }, { status: 400 });
  const db = await getDb();
  const [entry] = await db.insert(knowledgeEntries).values({ question, answer, keywords, createdBy: user.email }).returning();
  return Response.json({ entry }, { status: 201 });
}
