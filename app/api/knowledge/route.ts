import { createAdminSupabase } from "../../lib/supabase/admin";
import { getCurrentUser } from "../../auth";
import { isAgent } from "../../service-routing";

const ENTRY_SELECT = "id, question, answer, keywords, active, createdBy:created_by, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: entries } = await admin.from("knowledge_entries").select(ENTRY_SELECT).order("updated_at", { ascending: false });
  return Response.json({ entries: entries || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { question?: string; answer?: string; keywords?: string };
  const question = (body.question || "").trim().slice(0, 500);
  const answer = (body.answer || "").trim().slice(0, 5000);
  const keywords = (body.keywords || "").trim().slice(0, 1000);
  if (!question || !answer) return Response.json({ error: "Question and answer are required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: entry, error } = await admin
    .from("knowledge_entries")
    .insert({ question, answer, keywords, created_by: user.email })
    .select(ENTRY_SELECT)
    .single();

  if (error) return Response.json({ error: "Unable to save entry" }, { status: 500 });
  return Response.json({ entry }, { status: 201 });
}
