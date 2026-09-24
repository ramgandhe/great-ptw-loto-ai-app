"use client";

import { useEffect, useState } from "react";
import { organisationsApi } from "@/lib/organisation/api";

export function TenantName({ className }: { className?: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    organisationsApi
      .list()
      .then((rows) => setName(rows[0]?.name ?? null))
      .catch(() => setName(null));
  }, []);

  if (!name) {
    return null;
  }

  return <p className={className}>{name}</p>;
}
