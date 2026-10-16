"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { AUTH_FIELD, AUTH_LINK, PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { setFirstPassword, signIn } from "@/lib/auth/session";
import { isAuthenticated } from "@/lib/auth/token-storage";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // First sign-in with a temporary password asks for the person's own before going in.
  const [step, setStep] = useState<"sign-in" | "new-password">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace(next);
  }, [next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === "new-password" && newPassword !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (step === "sign-in") await signIn(email, password);
      else await setFirstPassword(email, password, newPassword);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PASSWORD_CHANGE_REQUIRED") {
        setStep("new-password");
      } else {
        setError(err instanceof ApiError ? err.message : "We couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  const newPasswordStep = step === "new-password";

  return (
    <section className="w-full">
      <div className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        <ShieldCheck className="size-4" aria-hidden />
        PermitWiseAI workspace
      </div>
      <div>
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            Organisation user sign-in
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            {newPasswordStep ? "Set your own password" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {newPasswordStep
              ? "You signed in with a temporary password. Choose your own to continue."
              : "Enter your registered work email and password to continue."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">
          {newPasswordStep ? (
            <>
              <p className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                Signing in as <strong className="font-semibold">{email}</strong>
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-sm font-medium">
                  New password
                </label>
                <div className="[&_input]:rounded-[8px]! [&_button]:rounded-r-[8px]!">
                  <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">At least 8 characters. A short sentence is easy to remember and hard to guess.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-sm font-medium">
                  Type it again
                </label>
                <div className="[&_input]:rounded-[8px]! [&_button]:rounded-r-[8px]!">
                  <PasswordInput
                    id="confirm-password"
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                    invalid={confirm.length > 0 && confirm !== newPassword}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-semibold">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus={!email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${AUTH_FIELD} rounded-[8px]!`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className={`text-sm ${AUTH_LINK}`}>
                    Forgot password?
                  </Link>
                </span>
                <div className="[&_input]:rounded-[8px]! [&_button]:rounded-r-[8px]!">
                  <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} />
                </div>
              </div>
            </>
          )}

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={busy} className="mt-1 h-11 w-full text-base">
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {busy ? (newPasswordStep ? "Saving…" : "Signing in…") : newPasswordStep ? "Save password and sign in" : "Sign in"}
          </Button>

          {newPasswordStep ? (
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep("sign-in");
                setPassword("");
                setNewPassword("");
                setConfirm("");
                setError(null);
              }}
            >
              Use a different account
            </button>
          ) : null}
        </form>

        {!newPasswordStep ? (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
            New to the platform?{" "}
            <Link href="/register" className={AUTH_LINK}>
              Request access
            </Link>
            </p>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to site
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginContent />
    </Suspense>
  );
}
