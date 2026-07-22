import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clientProfiles = sqliteTable("client_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  onboardingStatus: text("onboarding_status").notNull().default("in_progress"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  profileJson: text("profile_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userPolicies = sqliteTable("user_policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  policyNumber: text("policy_number").notNull(),
  policyType: text("policy_type").notNull().default(""),
  carrier: text("carrier").notNull().default(""),
  insuredName: text("insured_name").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  deathBenefit: text("death_benefit").notNull().default(""),
  monthlyPremium: text("monthly_premium").notNull().default(""),
  effectiveDate: text("effective_date").notNull().default(""),
  beneficiaries: text("beneficiaries").notNull().default(""),
  cashValue: text("cash_value").notNull().default(""),
  sourceFileName: text("source_file_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("user_policy_number_idx").on(table.userEmail, table.policyNumber)]);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  fileSize: integer("file_size").notNull().default(0),
  policyNumber: text("policy_number").notNull().default(""),
  processingStatus: text("processing_status").notNull().default("processed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const serviceRequests = sqliteTable("service_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  requestType: text("request_type").notNull(),
  details: text("details").notNull().default(""),
  requestDataJson: text("request_data_json").notNull().default("{}"),
  status: text("status").notNull().default("new"),
  assignedTo: text("assigned_to").notNull().default(""),
  source: text("source").notNull().default("client"),
  priority: text("priority").notNull().default("normal"),
  unreadByAgent: integer("unread_by_agent", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agentNotifications = sqliteTable("agent_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentEmail: text("agent_email").notNull(),
  clientEmail: text("client_email").notNull(),
  serviceRequestId: integer("service_request_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const knowledgeEntries = sqliteTable("knowledge_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: text("keywords").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  role: text("role").notNull(),
  message: text("message").notNull(),
  resolution: text("resolution").notNull().default("answered"),
  serviceRequestId: integer("service_request_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
