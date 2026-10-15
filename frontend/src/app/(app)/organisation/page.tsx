"use client";

import { DOMAIN_ICONS } from "@/lib/domain-icons";
import {
  Bell,
  Building2,
  ClipboardCheck,
  FileStack,
  GitBranch,
  Tags,
  UserCog,
} from "lucide-react";
import { HubPage, type HubGroup } from "@/components/layout/hub-page";
import { TenantName } from "@/components/organisation/tenant-name";
import { SetupProgressCard } from "@/components/organisation/setup-progress-card";

const GROUPS: HubGroup[] = [
  {
    title: "Site structure",
    description: "Sites, then the locations and assets under them.",
    links: [
      { href: "/organisation/sites", label: "Sites", description: "Physical sites and who may work there", icon: DOMAIN_ICONS.plant },
      { href: "/organisation/work-locations", label: "Work locations", description: "Areas under a site, with approvers", icon: DOMAIN_ICONS.location },
      { href: "/organisation/assets", label: "Assets", description: "Equipment register and LOTOTO targets", icon: DOMAIN_ICONS.machinery },
    ],
  },
  {
    title: "Permits and safety catalogues",
    description: "What people pick when they raise a permit.",
    links: [
      { href: "/organisation/permit-types", label: "Permit types", description: "Types, fields and colours", icon: Tags },
      { href: "/organisation/templates", label: "Permit templates", description: "Pre-filled starting points", icon: FileStack },
      { href: "/organisation/hazards", label: "Hazards", description: "Codes, consequences and default controls", icon: DOMAIN_ICONS.hazard },
      { href: "/organisation/ppe", label: "PPE", description: "Protective equipment requirements", icon: DOMAIN_ICONS.ppe },
      { href: "/organisation/gas-testing", label: "Gas testing", description: "Parameters and limits by work location or asset", icon: DOMAIN_ICONS.gas },
      { href: "/organisation/checklists", label: "Safety checklists", description: "Reusable checklist items", icon: ClipboardCheck },
    ],
  },
  {
    title: "People and workflow",
    description: "Who can do what, and how approvals and messages flow.",
    links: [
      { href: "/workforce/roles", label: "Users and roles", description: "Logins, roles and site access", icon: UserCog },
      { href: "/organisation/workflows", label: "Approval workflows", description: "Approval stages and routing", icon: GitBranch },
      { href: "/organisation/notifications", label: "Notification preferences", description: "Channels and events", icon: Bell },
      { href: "/organisation/profile", label: "Organisation profile", description: "Registration and details", icon: Building2 },
    ],
  },
];

export default function OrganisationDashboardPage() {
  return (
    <HubPage title="Organisation" intro={<TenantName className="font-medium" />} groups={GROUPS}>
      <SetupProgressCard />
    </HubPage>
  );
}
