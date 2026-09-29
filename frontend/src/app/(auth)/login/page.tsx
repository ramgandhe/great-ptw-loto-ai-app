"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { AUTH_FIELD, AUTH_LINK, PasswordInput } from "@/components/auth/password-input";
import { BackLink } from "@/components/layout/page-header";
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
    <div className="flex flex-col gap-7">
      <div>
        <BackLink href="/" label="Home" />
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{newPasswordStep ? "Set your own password" : "Sign in"}</h1>
        <p className="mt-1.5 text-muted-foreground">
          {newPasswordStep
            ? "You signed in with a temporary password. Choose your own to continue."
            : "Use the work email your organisation registered."}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {newPasswordStep ? (
          <>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              Signing in as <strong className="font-semibold">{email}</strong>
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                New password
              </label>
              <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">At least 8 characters. A short sentence is easy to remember and hard to guess.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Type it again
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                invalid={confirm.length > 0 && confirm !== newPassword}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
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
                className={AUTH_FIELD}
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
              <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} />
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        <p className="border-t border-border pt-5 text-sm text-muted-foreground">
          New to the platform?{" "}
          <Link href="/register" className={AUTH_LINK}>
            Request access
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginContent />
    </Suspense>
  );
}
