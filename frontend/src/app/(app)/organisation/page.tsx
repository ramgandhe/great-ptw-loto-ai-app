"use client";

import { DOMAIN_ICONS } from "@/lib/domain-icons";
import {
  Bell,
  Building2,
  ClipboardCheck,
  FileStack,
  GitBranch,
  Network,
  Tags,
  UserCog,
} from "lucide-react";
import { HubPage, type HubGroup } from "@/components/layout/hub-page";
import { TenantName } from "@/components/organisation/tenant-name";
import { SetupProgressCard } from "@/components/organisation/setup-progress-card";

const GROUPS: HubGroup[] = [
  {
    title: "Site structure",
    description: "Set up in this order: each level is picked from the one above it.",
    links: [
      { href: "/organisation/plants", label: "Plants", description: "Top-level operational sites", icon: DOMAIN_ICONS.plant },
      { href: "/organisation/departments", label: "Departments", description: "Teams that own work", icon: Network },
      { href: "/organisation/locations", label: "Locations", description: "Work areas within plants", icon: DOMAIN_ICONS.location },
      { href: "/organisation/workstations", label: "Workstations", description: "Where equipment is installed", icon: DOMAIN_ICONS.workstation },
      { href: "/organisation/machinery", label: "Machinery", description: "Equipment and its isolation plans", icon: DOMAIN_ICONS.machinery },
    ],
  },
  {
    title: "Permits and safety catalogues",
    description: "What people pick when they raise a permit.",
    links: [
      { href: "/organisation/permit-types", label: "Permit types", description: "Types, fields and colours", icon: Tags },
      { href: "/organisation/templates", label: "Permit templates", description: "Pre-filled starting points", icon: FileStack },
      { href: "/organisation/hazards", label: "Hazards", description: "Hazard categories", icon: DOMAIN_ICONS.hazard },
      { href: "/organisation/ppe", label: "PPE", description: "Protective equipment requirements", icon: DOMAIN_ICONS.ppe },
      { href: "/organisation/gas-testing", label: "Gas testing", description: "Parameters and limits by workstation", icon: DOMAIN_ICONS.gas },
      { href: "/organisation/checklists", label: "Safety checklists", description: "Reusable checklist items", icon: ClipboardCheck },
    ],
  },
  {
    title: "People and workflow",
    description: "Who can do what, and how approvals and messages flow.",
    links: [
      { href: "/workforce/roles", label: "Users and roles", description: "Logins and organisation roles", icon: UserCog },
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
