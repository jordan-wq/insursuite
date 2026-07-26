"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientSupabase } from "../../lib/supabase/client";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClientSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) throw signInError;
      router.replace("/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="marketing-page login-page staff-login-page">
      <section className="marketing-hero login-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Admin access only</span>
          <h1>InsurSuite Admin</h1>
          <p>Sign in to your admin console.</p>
        </div>
        <div className="auth-panel-wrap">
          <form className="auth-card" onSubmit={submit}>
            <span className="form-icon"><ShieldCheck size={23} /></span>
            <h2>Admin sign in</h2>
            <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
            <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full" disabled={loading}>{loading ? "Signing in..." : "Sign in as admin"}</button>
            <small className="privacy-line">Not an admin? <Link href="/login">Sign in as client</Link></small>
          </form>
        </div>
      </section>
    </main>
  );
}
