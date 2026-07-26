import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { getCurrentUser } from "../../auth";
import { isAgent } from "../../service-routing";

export default async function StaffShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) redirect("/?notice=staff_access_denied");
  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Link href="/staff" className="gate-brand"><ShieldCheck size={22} /><strong>InsurSuite <span>Staff</span></strong></Link>
        <nav>
          <Link href="/staff">Queue</Link>
          <Link href="/staff/team"><Users size={16} />Manage Staff</Link>
        </nav>
        <form action="/auth/signout" method="post"><button type="submit" className="text-button">Sign out</button></form>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}
