import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Users, BookOpen, UserCog, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "../../auth";
import { isAgent } from "../../service-routing";

export default async function StaffShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) redirect("/?notice=staff_access_denied");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={25} /></div><div><strong>Insur<span>Suite</span></strong><small>Admin Console</small></div></div>
        <nav aria-label="Staff navigation">
          <Link href="/staff"><LayoutDashboard size={20} /><span>Overview</span></Link>
          <Link href="/staff/conversations"><MessagesSquare size={20} /><span>Conversations</span></Link>
          <Link href="/staff/clients"><Users size={20} /><span>Clients</span></Link>
          <Link href="/staff/knowledge"><BookOpen size={20} /><span>Knowledge</span></Link>
          <Link href="/staff/team"><UserCog size={20} /><span>Manage Staff</span></Link>
        </nav>
        <form action="/auth/signout" method="post"><button type="submit" className="text-button" style={{ color: "#cfe0fb", marginTop: "auto" }}>Sign out</button></form>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
