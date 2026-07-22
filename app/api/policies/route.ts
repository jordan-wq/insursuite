import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userPolicies } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isVercelDemoStore, vercelListPolicies, vercelSavePolicy } from "../../vercel-demo-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (isVercelDemoStore()) return vercelListPolicies(user);
  const db = await getDb();
  return Response.json({ policies: await db.select().from(userPolicies).where(eq(userPolicies.userEmail, user.email)) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as Record<string, string>;
  if (isVercelDemoStore()) return vercelSavePolicy(user, body);
  const clean = (value: string | undefined, max = 160) => (value || "").trim().slice(0, max);
  const policyNumber = clean(body.policyNumber, 40);
  if (!policyNumber) return Response.json({ error: "Policy number is required" }, { status: 400 });
  const values = { userEmail: user.email, policyNumber, policyType: clean(body.policyType), carrier: clean(body.carrier), insuredName: clean(body.insuredName), ownerName: clean(body.ownerName), deathBenefit: clean(body.deathBenefit, 40), monthlyPremium: clean(body.monthlyPremium, 40), effectiveDate: clean(body.effectiveDate, 40), beneficiaries: clean(body.beneficiaries, 800), cashValue: clean(body.cashValue, 40), sourceFileName: clean(body.sourceFileName, 240), updatedAt: new Date().toISOString() };
  const db = await getDb();
  const [policy] = await db.insert(userPolicies).values(values).onConflictDoUpdate({ target: [userPolicies.userEmail, userPolicies.policyNumber], set: values }).returning();
  return Response.json({ policy }, { status: 201 });
}
