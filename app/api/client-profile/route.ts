import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clientProfiles, documents, serviceRequests, userPolicies } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sanitizeProfile } from "../../profile-fields";
import { isAgent } from "../../service-routing";
import { isVercelDemoStore, vercelPortalData, vercelSaveProfile } from "../../vercel-demo-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (isVercelDemoStore()) return vercelPortalData(user);
  const db = await getDb();
  const [profile] = await db.select().from(clientProfiles).where(eq(clientProfiles.userEmail, user.email)).limit(1);
  const policies = await db.select().from(userPolicies).where(eq(userPolicies.userEmail, user.email));
  const files = await db.select({ id: documents.id, fileName: documents.fileName, contentType: documents.contentType, fileSize: documents.fileSize, policyNumber: documents.policyNumber, processingStatus: documents.processingStatus, createdAt: documents.createdAt }).from(documents).where(eq(documents.userEmail, user.email));
  const requests = await db.select().from(serviceRequests).where(eq(serviceRequests.userEmail, user.email));
  return Response.json({ user, isAgent: await isAgent(user.email), profile: profile ? { ...profile, profile: JSON.parse(profile.profileJson || "{}") } : null, policies, documents: files, requests });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { fullName?: string; phone?: string; dateOfBirth?: string; onboardingStatus?: string; onboardingStep?: number; profile?: Record<string, unknown> };
  if (isVercelDemoStore()) return vercelSaveProfile(user, body);
  const cleanProfile = sanitizeProfile(body.profile);
  const fullName = (body.fullName?.trim() || user.fullName || user.displayName).slice(0, 120);
  const status = ["in_progress", "completed"].includes(body.onboardingStatus || "") ? body.onboardingStatus! : "in_progress";
  const values = { userEmail: user.email, fullName, phone: body.phone?.trim().slice(0, 30) || "", dateOfBirth: body.dateOfBirth?.trim().slice(0, 10) || "", onboardingStatus: status, onboardingStep: Math.max(0, Math.min(7, Number(body.onboardingStep) || 0)), profileJson: JSON.stringify(cleanProfile), updatedAt: new Date().toISOString() };
  const db = await getDb();
  const [profile] = await db.insert(clientProfiles).values(values).onConflictDoUpdate({ target: clientProfiles.userEmail, set: values }).returning();
  return Response.json({ profile: { ...profile, profile: JSON.parse(profile.profileJson || "{}") } });
}
