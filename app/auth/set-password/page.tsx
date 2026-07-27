"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientSupabase } from "../../lib/supabase/client";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://insursuite.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("return_to"));
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClientSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClientSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div className="auth-card"><p>Checking your link...</p></div>;

  if (!hasSession) {
    return (
      <div className="auth-card">
        <span className="form-icon"><LockKeyhole size={23} /></span>
        <h2>This link has expired</h2>
        <p>Ask whoever invited you for a fresh link, or request a new password reset from the sign-in page.</p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <span className="form-icon"><ShieldCheck size={23} /></span>
      <h2>Set your password</h2>
      <p>Choose a password to finish setting up your account.</p>
      <label>
        New password
        <span className="password-field">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <label>
        Confirm password
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full" disabled={loading}>
        {loading ? "Saving..." : "Set password and continue"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <main className="marketing-page login-page">
      <section className="marketing-hero login-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Secure account setup</span>
          <h1>Almost there.</h1>
          <p>Set a password to finish securing your account.</p>
        </div>
        <div className="auth-panel-wrap">
          <Suspense fallback={<div className="auth-card"><p>Loading...</p></div>}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
