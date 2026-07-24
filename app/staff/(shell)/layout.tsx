import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

export default function StaffShellLayout({ children }: { children: React.ReactNode }) {
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
