export const SERVICE_REQUEST_STATUSES = ["new", "assigned", "in_progress", "waiting_on_client", "resolved"] as const;
export const AGENT_EDITABLE_REQUEST_STATUSES = ["assigned", "in_progress", "waiting_on_client", "resolved"] as const;
export const SERVICE_REQUEST_PRIORITIES = ["normal", "urgent"] as const;

export type ServiceRequestStatus = typeof SERVICE_REQUEST_STATUSES[number];
export type AgentEditableRequestStatus = typeof AGENT_EDITABLE_REQUEST_STATUSES[number];
export type ServiceRequestPriority = typeof SERVICE_REQUEST_PRIORITIES[number];
export type ServiceRequestData = Record<string, string | boolean>;

export const URGENT_REQUEST_LABEL = "Urgent - coverage or payment at risk";

export const SERVICE_REQUEST_DATA_FIELDS = [
  "policyNumber",
  "urgency",
  "contactMethod",
  "bestContactTime",
  "desiredOutcome",
  "effectiveDate",
  "amountInQuestion",
  "carrierContacted",
  "documentsAvailable",
  "authorization",
] as const;

const editableStatusSet = new Set<string>(AGENT_EDITABLE_REQUEST_STATUSES);
const requestDataFieldSet = new Set<string>(SERVICE_REQUEST_DATA_FIELDS);

export function isAgentEditableRequestStatus(status: unknown): status is AgentEditableRequestStatus {
  return typeof status === "string" && editableStatusSet.has(status);
}

export function initialRequestStatus(assignedTo?: string | null): ServiceRequestStatus {
  return assignedTo ? "assigned" : "new";
}

export function priorityForUrgency(urgency: unknown): ServiceRequestPriority {
  return urgency === URGENT_REQUEST_LABEL ? "urgent" : "normal";
}

export function sanitizeServiceRequestData(input: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => requestDataFieldSet.has(key) && (typeof value === "string" || typeof value === "boolean"))
      .map(([key, value]) => [key, typeof value === "string" ? value.trim().slice(0, 500) : value]),
  ) as ServiceRequestData;
}
