"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, MailCheck } from "lucide-react";
import { AUTH_FIELD, AUTH_LINK } from "@/components/auth/password-input";
import { BackLink } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth/session";

/** Seconds before another link can be asked for, so a mistyped click does not flood the inbox. */
const RESEND_AFTER = 60;

function ForgotContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSentTo(email.trim());
      setWait(RESEND_AFTER);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "Too Many Requests"
          ? "Too many requests. Wait a minute, then try again."
          : err instanceof ApiError
            ? err.message
            : "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-7" role="status">
        <div>
          <BackLink href="/login" label="Sign in" />
          <span className="mt-3 grid size-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--accent-primary)_14%,transparent)] text-(--accent-primary)">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-1.5 text-muted-foreground">
            If <strong className="font-semibold text-foreground">{sentTo}</strong> has an account, a link to choose a new
            password is on its way. It works once, for 30 minutes.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Nothing after a few minutes? Check spam, or make sure the address is the one you sign in with.</p>
        <div className="flex flex-col gap-3">
          <Button type="button" variant="outline" size="lg" className="h-11 w-full" disabled={busy || wait > 0} onClick={() => void send()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {wait > 0 ? `Send again in ${wait}s` : "Send the link again"}
          </Button>
          <button type="button" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setSentTo(null)}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <BackLink href="/login" label="Sign in" />
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Forgot your password?</h1>
        <p className="mt-1.5 text-muted-foreground">Enter your work email and we will send you a link to choose a new one.</p>
      </div>

      <form onSubmit={send} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} className="mt-1 h-11 w-full text-base">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="border-t border-border pt-5 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ForgotContent />
    </Suspense>
  );
}
