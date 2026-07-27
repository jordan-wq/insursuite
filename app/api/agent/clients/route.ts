import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const LIST_SELECT = "userId:user_id, fullName:full_name, email, onboardingStatus:onboarding_status, createdAt:created_at";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const url = new URL(request.url);
  const admin = createAdminSupabase();

  if (!url.searchParams.has("query")) {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 25));
    const from = (page - 1) * pageSize;
    const { data: clients, count } = await admin
      .from("client_profiles")
      .select(LIST_SELECT, { count: "exact" })
      .order("full_name", { ascending: true })
      .range(from, from + pageSize - 1);
    return Response.json({ clients: clients || [], total: count || 0 });
  }

  // Strip characters that are syntactically meaningful in a PostgREST
  // .or() filter string (",", "(", ")") so a search term can't break out
  // of the intended two-column filter into an arbitrary one.
  const query = (url.searchParams.get("query") || "").trim().replace(/[,()]/g, "");
  if (query.length < 2) return Response.json({ clients: [] });

  const { data: clients } = await admin
    .from("client_profiles")
    .select("userId:user_id, fullName:full_name, email")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return Response.json({ clients: clients || [] });
}
