import Link from "next/link";
import { CircleHelp, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="portal-gate">
      <div className="gate-card">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <span className="gate-icon"><CircleHelp size={31} /></span>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
        <Link className="primary-button gate-signin" href="/">Back to InsurSuite</Link>
      </div>
    </main>
  );
}
