"use client";

import { createContext, useContext } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Set by the permit workspace (/permits/[id]) when it shows another permit page inside a tab. */
export const PermitWorkspaceContext = createContext<string | null>(null);

/** True inside the workspace: the page leaves out its own title header and page padding. */
export function useInPermitWorkspace(): boolean {
  return useContext(PermitWorkspaceContext) !== null;
}

/** The permit a page shows: the workspace's when embedded, otherwise the route's `param`. */
export function usePermitPageId(param: "id" | "permitId"): string {
  const embedded = useContext(PermitWorkspaceContext);
  const params = useParams<Record<string, string>>();
  return embedded ?? params[param];
}

/** The page's outer element: `<main>` with padding on its own route, a plain block inside the workspace. */
export function PermitPageShell({ children }: { children: React.ReactNode }) {
  const embedded = useInPermitWorkspace();
  const Tag = embedded ? "div" : "main";
  return <Tag className={cn("flex flex-1 flex-col gap-6", !embedded && "p-4 sm:p-8")}>{children}</Tag>;
}
