"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function recordHref(kind: string, id = "new", query = "") {
  return `/platform/configuration/record/${kind}/${id}${query ? `?${query}` : ""}`;
}

export function CatalogueAdd({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex justify-end">
      <Link href={href} className={cn(buttonVariants({ variant: "outline" }))}>
        {label}
      </Link>
    </div>
  );
}

export function Alert({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
