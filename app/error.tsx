"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleHelp, ShieldCheck } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="portal-gate">
      <div className="gate-card">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <span className="gate-icon error"><CircleHelp size={31} /></span>
        <h1>Something went wrong</h1>
        <p>We hit an unexpected error loading this page. Your information is safe — try again, or head back to InsurSuite.</p>
        <button className="primary-button gate-signin" type="button" onClick={() => reset()}>Try again</button>
        <small><Link href="/">Back to InsurSuite</Link></small>
      </div>
    </main>
  );
}
