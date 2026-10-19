"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";
import { buttonVariants } from "@/components/ui/button";

type PpeCategory = { id: string; name: string };

export default function PpePage() {
  const [categories, setCategories] = useState<PpeCategory[]>([]);

  useEffect(() => {
    fetchApi<PpeCategory[]>("/ppe-categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const fields = useMemo<EntityField[]>(
    () => [
      { key: "name", label: "PPE item", required: true },
      { key: "code", label: "Code", required: true },
      {
        key: "category",
        label: "Category",
        required: true,
        options: categories.map((category) => ({ value: category.name, label: category.name })),
      },
      { key: "description", label: "Description", multiline: true },
    ],
    [categories],
  );

  return (
    <EntityCrudPage
      title="PPE configuration"
      description="Protective equipment. Categories are labels the admin manages."
      resource="ppe"
      fields={fields}
    >
      <div className="flex justify-end">
        <Link href="/organisation/ppe/categories" className={buttonVariants({ variant: "outline" })}>
          Add PPE categories
        </Link>
      </div>
    </EntityCrudPage>
  );
}
