"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, AlertTriangle, UserX, PackageX } from "lucide-react";
import { Panel, PanelHeader, ViewHeading } from "../../components/shared";

type Stats = { openConversations: number; urgentUnread: number; unassigned: number; packetsPending: number };

export default function StaffOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { fetch("/api/agent/overview", { cache: "no-store" }).then((r) => r.json()).then(setStats); }, []);

  const tiles: { label: string; value: number | string; icon: typeof Inbox; href: string }[] = [
    { label: "Open conversations", value: stats?.openConversations ?? "—", icon: Inbox, href: "/staff/conversations" },
    { label: "Urgent / unread", value: stats?.urgentUnread ?? "—", icon: AlertTriangle, href: "/staff/conversations?filter=urgent" },
    { label: "Unassigned", value: stats?.unassigned ?? "—", icon: UserX, href: "/staff/conversations?filter=unassigned" },
    { label: "Packets pending delivery", value: stats?.packetsPending ?? "—", icon: PackageX, href: "/staff/clients" },
  ];

  return <div className="section-view"><ViewHeading eyebrow="Admin console" title="Overview" description="What needs attention across the team right now." /><div className="agent-console-grid">{tiles.map((tile) => <Link key={tile.label} href={tile.href} className="stat-card" style={{ textDecoration: "none", color: "inherit" }}><div><span className="eyebrow-row"><tile.icon size={16} />{tile.label}</span><strong className="stat-value">{tile.value}</strong></div></Link>)}</div><Panel style={{ marginTop: 16 }}><PanelHeader title="Quick links" /><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/staff/conversations" className="secondary-button">View all conversations</Link><Link href="/staff/clients" className="secondary-button">Browse clients</Link></div></Panel></div>;
}
