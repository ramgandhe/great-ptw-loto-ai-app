import type { Metadata } from "next";
import { AccessRequestForm } from "@/components/marketing/access-request-form";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Request access | ${SITE.product}`,
  description: `Request an organisation account for ${SITE.product}.`,
};

const NEXT_STEPS = [
  "We reply to plan your setup and confirm which modules you need.",
  "We create your organisation and invite your administrator by email.",
  "Your administrator signs in, sets a password and adds departments, sites and people.",
];

export default function RegisterPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:py-20">
      <div>
        <h1 className="font-heading text-4xl font-extrabold tracking-tight">Request access</h1>
        <p className="mt-4 max-w-md leading-7 text-muted-foreground">
          {SITE.product} accounts are set up per organisation. Tell us about your site and we will
          get your first administrator signed in.
        </p>
        <h2 className="mt-10 text-sm font-semibold">What happens next</h2>
        <ol className="mt-4 space-y-4">
          {NEXT_STEPS.map((step, i) => (
            <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-6">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <AccessRequestForm />
    </div>
  );
}
