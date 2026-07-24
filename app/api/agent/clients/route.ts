import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  // Strip characters that are syntactically meaningful in a PostgREST
  // .or() filter string (",", "(", ")") so a search term can't break out
  // of the intended two-column filter into an arbitrary one.
  const query = (new URL(request.url).searchParams.get("query") || "").trim().replace(/[,()]/g, "");
  if (query.length < 2) return Response.json({ clients: [] });

  const admin = createAdminSupabase();
  const { data: clients } = await admin
    .from("client_profiles")
    .select("userId:user_id, fullName:full_name, email")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return Response.json({ clients: clients || [] });
}
