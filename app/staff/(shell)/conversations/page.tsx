"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Panel, PanelHeader, ViewHeading, ticketCode } from "../../../components/shared";
import { createClientSupabase } from "../../../lib/supabase/client";

type ServiceRequest = { id: string; requestType: string; details: string; status: string; createdAt: string; assignedTo?: string; source?: string; requestDataJson?: string; priority?: string };
type QueueItem = ServiceRequest & { clientName: string; userId: string; unreadByAgent: boolean; requestData?: Record<string, string | boolean>; assignedToEmail: string | null };
type ClientPolicy = { id: string; policyNumber: string; carrier: string; packetStatus: string };
type StaffMember = { userId: string; email: string };

export default function ConversationsPage() {
  // useSearchParams() requires a Suspense boundary in the App Router (same pattern already used by app/login/page.tsx)
  return <Suspense fallback={<div className="section-view"><p className="modal-copy">Loading...</p></div>}><ConversationsView /></Suspense>;
}

function ConversationsView() {
  const filter = useSearchParams().get("filter"); // "urgent" | "unassigned" | null, set by Overview tile links
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientPolicies, setClientPolicies] = useState<Record<string, ClientPolicy[]>>({});
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<{ id: string; senderRole: string; message: string; createdAt: string }[]>([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<{ userId: string; fullName: string; email: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ userId: string; fullName: string } | null>(null);
  const [newRequestType, setNewRequestType] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/agent/conversations", { cache: "no-store" });
    if (response.ok) setQueue((await response.json()).requests || []);
  };
  useEffect(() => {
    load();
    fetch("/api/staff/team", { cache: "no-store" }).then((r) => r.json()).then((d) => setStaff(d.staff || []));
  }, []);

  // openRequestId changes after this effect's single run (user opens a thread later), so the
  // postgres_changes callback below reads it through a ref, not the closed-over state variable —
  // otherwise it would always see the initial `null` and never refresh an open thread.
  const openRequestIdRef = useRef<string | null>(null);
  useEffect(() => { openRequestIdRef.current = openRequestId; }, [openRequestId]);

  useEffect(() => {
    const supabase = createClientSupabase();
    const channel = supabase
      .channel("staff-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_request_messages" }, () => {
        load();
        if (openRequestIdRef.current) openThread(openRequestIdRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (id: string, status: string) => { await fetch("/api/agent/conversations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); load(); };
  const reassign = async (id: string, assignedTo: string | null) => { await fetch("/api/agent/conversations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, assignedTo }) }); load(); };

  const toggleClient = async (clientId: string) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    setPolicyError(null);
    if (!clientPolicies[clientId]) {
      const response = await fetch(`/api/agent/policies?clientId=${clientId}`);
      if (response.ok) { const result = await response.json(); setClientPolicies((current) => ({ ...current, [clientId]: result.policies })); }
      else setPolicyError("Could not load policies for this client.");
    }
  };
  const updatePacketStatus = async (policyId: string, clientId: string, packetStatus: string) => {
    const response = await fetch("/api/agent/policies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: policyId, packetStatus }) });
    if (response.ok) {
      setClientPolicies((current) => ({ ...current, [clientId]: current[clientId].map((p) => p.id === policyId ? { ...p, packetStatus } : p) }));
    } else {
      setPolicyError("Could not update packet status — please try again.");
    }
  };
  const openThread = async (requestId: string) => {
    setOpenRequestId(requestId);
    const response = await fetch(`/api/agent/requests/${requestId}/messages`, { cache: "no-store" });
    if (response.ok) setThreadMessages((await response.json()).messages || []);
  };
  const sendThreadMessage = async () => {
    const text = threadDraft.trim();
    if (!text || !openRequestId || threadSending) return;
    setThreadSending(true);
    const response = await fetch(`/api/agent/requests/${openRequestId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
    if (response.ok) { setThreadDraft(""); openThread(openRequestId); load(); }
    setThreadSending(false);
  };
  const searchClients = async (q: string) => {
    setClientQuery(q);
    if (q.trim().length < 2) { setClientResults([]); return; }
    const response = await fetch(`/api/agent/clients?query=${encodeURIComponent(q)}`);
    if (response.ok) setClientResults((await response.json()).clients || []);
  };
  const startConversation = async () => {
    if (!selectedClient || !newRequestType.trim() || !newMessage.trim()) return;
    const response = await fetch("/api/agent/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: selectedClient.userId, requestType: newRequestType, message: newMessage }) });
    if (response.ok) { setShowNewConversation(false); setSelectedClient(null); setNewRequestType(""); setNewMessage(""); setClientQuery(""); setClientResults([]); load(); }
  };
  const activeThreadItem = queue.find((item) => item.id === openRequestId);
  const visibleQueue = filter === "urgent" ? queue.filter((item) => item.priority === "urgent" || item.unreadByAgent)
    : filter === "unassigned" ? queue.filter((item) => !item.assignedTo)
    : queue;

  return <div className="section-view"><ViewHeading eyebrow="Customer service operations" title="Conversations" description="Every client conversation across the team. Claim, reassign, or reply." /><div className="agent-console-grid"><Panel><PanelHeader title={`Open conversations (${queue.filter((item) => item.status !== "resolved").length})${filter ? ` — filtered: ${filter}` : ""}`} action={showNewConversation ? "Close" : "Start a conversation"} onAction={() => setShowNewConversation((current) => !current)} />{showNewConversation && <div className="new-conversation-panel"><input value={clientQuery} onChange={(e) => searchClients(e.target.value)} placeholder="Search clients by name or email..." aria-label="Search clients" />{!selectedClient && clientResults.length > 0 && <div className="client-search-results">{clientResults.map((client) => <button type="button" key={client.userId} onClick={() => { setSelectedClient({ userId: client.userId, fullName: client.fullName }); setClientResults([]); setClientQuery(client.fullName); }}><strong>{client.fullName}</strong><small>{client.email}</small></button>)}</div>}{selectedClient && <form className="knowledge-form" onSubmit={(e) => { e.preventDefault(); startConversation(); }}><span>Starting a conversation with <strong>{selectedClient.fullName}</strong> · <button type="button" className="text-button" onClick={() => setSelectedClient(null)}>Change</button></span><label>Request type<input value={newRequestType} onChange={(e) => setNewRequestType(e.target.value)} placeholder="e.g. Policy update" /></label><label>Opening message<textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Write the first message to the client..." /></label><button className="primary-button" type="submit" disabled={!newRequestType.trim() || !newMessage.trim()}>Start conversation</button></form>}</div>}{policyError && <p className="form-error">{policyError}</p>}<div className="agent-queue">{visibleQueue.map((item) => <article key={item.id} className={item.unreadByAgent ? "unread" : ""}><div><button type="button" className="text-button agent-client-name" onClick={() => toggleClient(item.userId)}><strong>{item.clientName}</strong></button><span>{item.requestType} · IS-{ticketCode(item.id)}{item.priority === "urgent" ? " · URGENT" : ""} · {item.assignedToEmail ? `Assigned to ${item.assignedToEmail}` : "Unassigned"}</span><p>{item.details}</p>{item.requestData && <dl className="agent-intake-details">{Object.entries(item.requestData).filter(([, value]) => value && value !== "on").map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{String(value)}</dd></div>)}</dl>}<small>{item.source === "chatbot" ? "Escalated by chatbot" : "Submitted by client form"}</small>{expandedClient === item.userId && <div className="agent-client-policies"><strong>Policies</strong>{clientPolicies[item.userId]?.length ? clientPolicies[item.userId].map((policy) => <div key={policy.id}><span>{policy.carrier || "Carrier needs review"} · #{policy.policyNumber}</span><select value={policy.packetStatus} onChange={(e) => updatePacketStatus(policy.id, item.userId, e.target.value)}><option value="not_sent">Not Sent</option><option value="sent">Sent</option><option value="delivered">Delivered</option></select></div>) : <p>No saved policies for this client yet.</p>}</div>}</div><div className="agent-queue-actions"><select value={item.assignedTo || ""} onChange={(e) => reassign(item.id, e.target.value || null)} aria-label="Reassign conversation"><option value="">Unassigned</option>{staff.map((member) => <option key={member.userId} value={member.userId}>{member.email}</option>)}</select><button type="button" className="secondary-button" onClick={() => openThread(item.id)}>Reply</button><select value={item.status} onChange={(e) => update(item.id, e.target.value)}><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_on_client">Waiting on client</option><option value="resolved">Resolved</option></select></div></article>)}{!visibleQueue.length && <div className="empty-state"><CheckCircle2 size={28} /><strong>No conversations</strong><p>{filter ? "Nothing matches this filter right now." : "New tickets will appear here."}</p></div>}</div></Panel>{openRequestId && <Panel className="request-thread-panel"><PanelHeader title={`Request IS-${ticketCode(openRequestId)}`} action="Close" onAction={() => setOpenRequestId(null)} /><div className="request-thread">{threadMessages.map((m) => <div key={m.id} className={`support-bubble ${m.senderRole === "agent" ? "consultant" : "user"}`}><span>{m.senderRole === "agent" ? "You" : activeThreadItem?.clientName || "Client"}</span><p>{m.message}<small>{new Date(m.createdAt).toLocaleString()}</small></p></div>)}{!threadMessages.length && <p className="modal-copy">No messages yet on this request.</p>}</div><form className="support-composer" onSubmit={(e) => { e.preventDefault(); sendThreadMessage(); }}><input value={threadDraft} onChange={(e) => setThreadDraft(e.target.value)} placeholder="Reply to this request..." aria-label="Reply to this request" /><button type="submit" disabled={!threadDraft.trim() || threadSending} aria-label="Send reply"><Send size={17} /></button></form></Panel>}</div></div>;
}
