import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("query")?.trim() || "";
  if (query.length < 2) return Response.json({ clients: [] });

  const admin = createAdminSupabase();
  const { data: clients } = await admin
    .from("client_profiles")
    .select("userId:user_id, fullName:full_name, email")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return Response.json({ clients: clients || [] });
}
