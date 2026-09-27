"use client";

import { Award, BadgeCheck, Building, HardHat, Search, UserCog, Users } from "lucide-react";
import { HubPage, type HubGroup } from "@/components/layout/hub-page";

const GROUPS: HubGroup[] = [
  {
    title: "People",
    description: "Everyone who can be named on a permit.",
    links: [
      { href: "/workforce/directory", label: "Directory", description: "Everyone in one searchable list", icon: Search },
      { href: "/workforce/employees", label: "Employees", description: "Your own staff", icon: Users },
      { href: "/workforce/contractors", label: "Contractors", description: "External workers", icon: HardHat },
      { href: "/workforce/agencies", label: "Agencies", description: "Companies supplying contractors", icon: Building },
    ],
  },
  {
    title: "Access and capability",
    description: "What each person may sign in to and is qualified for.",
    links: [
      { href: "/workforce/roles", label: "Users and roles", description: "Logins and organisation roles", icon: UserCog },
      { href: "/workforce/competencies", label: "Competencies", description: "Skills on record", icon: Award },
      { href: "/workforce/certifications", label: "Certifications", description: "Certificates and expiry", icon: BadgeCheck },
    ],
  },
];

export default function WorkforceDashboardPage() {
  return <HubPage title="Workforce" intro="People, contractors and what they are qualified to do." groups={GROUPS} />;
}
