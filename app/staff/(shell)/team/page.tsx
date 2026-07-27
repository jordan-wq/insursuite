"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type StaffMember = { userId: string; email: string; createdAt: string };
type PendingInvite = { id: string; email: string; createdAt: string };

export default function ManageStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const load = () => fetch("/api/staff/team", { cache: "no-store" }).then((r) => r.json()).then((d) => { setStaff(d.staff || []); setPendingInvites(d.pendingInvites || []); });
  useEffect(() => { load(); fetch("/api/client-profile").then((r) => r.json()).then((d) => setCurrentUserId(d.user?.id || "")); }, []);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/staff/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not grant access");
    else {
      if (result.invited) setNotice(`Invite sent to ${email}`);
      setEmail("");
      load();
    }
    setSaving(false);
  };

  const revoke = async (userId: string) => {
    if (!window.confirm("Revoke staff access for this person?")) return;
    await fetch(`/api/staff/team/${userId}`, { method: "DELETE" });
    load();
  };

  const cancelInvite = async (id: string) => {
    if (!window.confirm("Cancel this pending invite?")) return;
    await fetch(`/api/staff/invites/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="section-view">
      <ViewHeading eyebrow="Staff access" title="Manage Staff" description="Grant or revoke agent-console access, or invite someone new." />
      <Panel>
        <PanelHeader title="Grant access" />
        <form className="modal-form" onSubmit={grant}>
          <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="person@example.com" /></label>
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Grant staff access"}</button>
        </form>
      </Panel>
      <Panel>
        <PanelHeader title={`Current staff (${staff.length})`} />
        <div className="beneficiary-list">
          {staff.map((member) => (
            <div key={member.userId}>
              <span><strong>{member.email}</strong><small>Added {new Date(member.createdAt).toLocaleDateString()}</small></span>
              <button disabled={member.userId === currentUserId} onClick={() => revoke(member.userId)}>{member.userId === currentUserId ? "You" : "Revoke"}</button>
            </div>
          ))}
        </div>
      </Panel>
      {pendingInvites.length > 0 && (
        <Panel>
          <PanelHeader title={`Pending invites (${pendingInvites.length})`} />
          <div className="beneficiary-list">
            {pendingInvites.map((invite) => (
              <div key={invite.id}>
                <span><strong>{invite.email}</strong><small>Invited {new Date(invite.createdAt).toLocaleDateString()}</small></span>
                <button onClick={() => cancelInvite(invite.id)}>Cancel</button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
