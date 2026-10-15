import { checklistsApi } from "@/lib/master-data/checklists";
import { gasTestingApi, masterDataApi } from "@/lib/master-data/api";
import {
  approvalWorkflowsApi,
  hazardsApi,
  notificationPreferencesApi,
  organisationsApi,
  ppeConfigurationsApi,
  sitesApi,
} from "@/lib/organisation/api";
import { placeApi } from "@/lib/place/api";
import { permitTemplatesApi } from "@/lib/organisation/templates";
import { agenciesApi, competenciesApi, contractorsApi, employeesApi, listTenantUsers } from "@/lib/workforce/api";

export type SetupStepKey =
  | "profile"
  | "sites"
  | "work-locations"
  | "assets"
  | "hazards"
  | "ppe"
  | "permit-types"
  | "checklists"
  | "gas-testing"
  | "templates"
  | "workflows"
  | "users"
  | "employees"
  | "agencies"
  | "contractors"
  | "competencies"
  | "notifications";

export type SetupStep = {
  key: SetupStepKey;
  group: string;
  title: string;
  /** One line: what this step records. */
  summary: string;
  /** Why it matters: shown as the step's help. */
  why: string;
  tips: string[];
  /** Optional steps can be left empty without leaving the organisation unusable. */
  optional?: boolean;
  /** Steps whose records this step picks from. */
  needs?: SetupStepKey[];
  /** The standalone page for the same records. */
  href: string;
  /** How much is set up: records for list steps, filled fields (0 to 1) for the profile. */
  measure: () => Promise<number>;
};

type Listed = { status?: string | null; isActive?: boolean };
const active = (rows: Listed[]) => rows.filter((row) => row.status !== "archived" && row.isActive !== false).length;

async function countOnSites(kind: "locations" | "assets") {
  const sites = (await sitesApi.list()).filter((row) => row.status !== "archived");
  const groups = await Promise.all(
    sites.map((site) =>
      (kind === "locations" ? placeApi.listWorkLocations(site.id) : placeApi.listAssets(site.id)).catch(() => []),
    ),
  );
  return groups.reduce((sum, rows) => sum + active(rows), 0);
}

export const SETUP_STEPS: SetupStep[] = [
  {
    key: "profile",
    group: "Organisation",
    title: "Organisation profile",
    summary: "Name, legal details and time zone.",
    why: "Printed permits, audit records and every date in the app use these details.",
    tips: ["Use the legal name exactly as registered.", "Pick the time zone of your main site; permit windows follow it."],
    href: "/organisation/profile",
    measure: async () => {
      const [org] = await organisationsApi.list();
      if (!org) return 0;
      return [org.name, org.legalName, org.registrationNumber].filter((value) => value?.trim()).length / 3;
    },
  },
  {
    key: "sites",
    group: "Site structure",
    title: "Sites",
    summary: "The physical sites people work at.",
    why: "Permits, work locations and assets all belong to a site. People who are not an owner or admin only see sites they belong to.",
    tips: ["One site per physical place, for example “Pune Unit 1”.", "Add people on the site page. Owners and admins already see every site."],
    href: "/organisation/sites",
    measure: async () => active(await sitesApi.list()),
  },
  {
    key: "work-locations",
    group: "Site structure",
    title: "Work locations and approvers",
    summary: "Where work happens, and who may approve it.",
    why: "A permit names one work location. Approvers set on a location cover it and the locations under it, unless a child location sets its own.",
    tips: ["Build the tree people recognise on the ground: area, bay, skid.", "Leave approvers empty to inherit them from the parent. If none exist up the tree, any permit approver may approve."],
    needs: ["sites"],
    href: "/organisation/work-locations",
    measure: () => countOnSites("locations"),
  },
  {
    key: "assets",
    group: "Site structure",
    title: "Assets",
    summary: "Equipment that may need isolating.",
    why: "LOTOTO procedures hang off an asset. A permit lists assets only when the job needs them.",
    tips: ["The tag must be unique on the site.", "Put each asset on the work location where it sits."],
    optional: true,
    needs: ["work-locations"],
    href: "/organisation/assets",
    measure: () => countOnSites("assets"),
  },
  {
    key: "hazards",
    group: "Safety catalogues",
    title: "Hazards",
    summary: "Hazard categories people pick on a permit.",
    why: "Hazards drive the controls, PPE and checks a permit asks for, and feed incident analytics.",
    tips: [
      "Add the standard set (fire, electrical, confined space, height, excavation, and the rest of the catalogue) or create your own.",
      "Link each hazard to the permit types it belongs on.",
    ],
    href: "/organisation/hazards",
    measure: async () => active(await hazardsApi.list()),
  },
  {
    key: "ppe",
    group: "Safety catalogues",
    title: "PPE",
    summary: "Protective equipment requirements.",
    why: "Permits list the PPE the crew must wear; executors confirm it before starting.",
    tips: ["Helmet, safety shoes, gloves, goggles, full-body harness, SCBA…", "Category groups them on the permit."],
    href: "/organisation/ppe",
    measure: async () => active(await ppeConfigurationsApi.list()),
  },
  {
    key: "permit-types",
    group: "Permits",
    title: "Permit types",
    summary: "The kinds of permit you issue.",
    why: "People start every permit by choosing a type; its colour marks the permit everywhere in the app.",
    tips: [
      "Add the standard set (Hot, Cold, Confined space, Electrical, Work at height, Excavation) or create your own.",
      "Switch a type off instead of deleting it once permits use it.",
    ],
    href: "/organisation/permit-types",
    measure: async () => active(await masterDataApi.permitTypes()),
  },
  {
    key: "checklists",
    group: "Permits",
    title: "Safety checklists",
    summary: "Checks to complete before work starts.",
    why: "Checklists attached to a permit must be ticked off before the permit can move on.",
    tips: ["One checklist per kind of work, e.g. “Hot work pre-start”.", "Mark the items that must never be skipped as mandatory."],
    href: "/organisation/checklists",
    measure: async () => (await checklistsApi.list()).filter((bundle) => bundle.checklist.status !== "archived").length,
  },
  {
    key: "gas-testing",
    group: "Permits",
    title: "Gas testing",
    summary: "Safe limits for gas readings on a work location or an asset.",
    why: "A permit loads these limits from its work location and assets. The strictest limit is kept, and it cannot be loosened for that permit.",
    tips: ["Typical: Oxygen 19.5 to 23.5 %, LEL 0 to 10 %, H₂S 0 to 10 ppm, CO 0 to 25 ppm.", "A child location may add a test or tighten a limit. It cannot widen one."],
    optional: true,
    needs: ["work-locations"],
    href: "/organisation/gas-testing",
    measure: async () => (await gasTestingApi.list()).length,
  },
  {
    key: "templates",
    group: "Permits",
    title: "Permit templates",
    summary: "Permit forms and check sheets, linked to permit types.",
    why: "Templates hold the permit form and the check sheet each type of work needs, so every permit of that type asks the same questions.",
    tips: ["Import the reference set (safe work permit and eight check sheets) and adjust it to your site.", "Link each check sheet to the permit types it applies to."],
    optional: true,
    href: "/organisation/templates",
    measure: async () => active(await permitTemplatesApi.list()),
  },
  {
    key: "workflows",
    group: "Approvals",
    title: "Approval workflow",
    summary: "Who approves permits.",
    why: "Submitted permits go to the approver in the current workflow. Without one, permits cannot be approved.",
    tips: ["Most sites start with the head of department as approver.", "Only one workflow is current; activate a row to switch."],
    href: "/organisation/workflows",
    measure: async () => (await approvalWorkflowsApi.list()).filter((workflow) => workflow.isCurrent).length,
  },
  {
    key: "users",
    group: "People",
    title: "Users and roles",
    summary: "Who can sign in, and what they can do.",
    why: "Receivers raise permits, approvers approve them, operators carry out the work. Each needs a login with the right role.",
    tips: ["Add at least one receiver, one approver and one operator.", "Site access is set on the site, not here."],
    href: "/workforce/roles",
    measure: async () => (await listTenantUsers()).filter((user) => user.enabled).length,
  },
  {
    key: "employees",
    group: "People",
    title: "Employees",
    summary: "Your own staff who can be named on permits.",
    why: "Permits name the crew doing the work; employees appear in those pickers.",
    tips: ["Staff who work on site but never sign in still belong here."],
    href: "/workforce/employees",
    measure: async () => active(await employeesApi.list()),
  },
  {
    key: "agencies",
    group: "People",
    title: "Contractor agencies",
    summary: "Companies that supply contract workers.",
    why: "Contractors are linked to their agency, so you can see who supplied whom on any permit.",
    tips: ["Record GSTIN and a contact email for each agency."],
    optional: true,
    href: "/workforce/agencies",
    measure: async () => active(await agenciesApi.list()),
  },
  {
    key: "contractors",
    group: "People",
    title: "Contractors",
    summary: "External workers who can be named on permits.",
    why: "Contract crews appear alongside employees when a permit names who is doing the work.",
    tips: ["Pick the agency each contractor comes from."],
    optional: true,
    needs: ["agencies"],
    href: "/workforce/contractors",
    measure: async () => active(await contractorsApi.list()),
  },
  {
    key: "competencies",
    group: "People",
    title: "Competencies and certificates",
    summary: "Who is qualified for what, and until when.",
    why: "Recording certificates with expiry dates shows who is qualified for hot work, confined space or electrical jobs.",
    tips: ["Start with certificates that expire, such as confined-space entry or electrical licences."],
    optional: true,
    needs: ["employees"],
    href: "/workforce/certifications",
    measure: async () => (await competenciesApi.list()).length,
  },
  {
    key: "notifications",
    group: "Notifications",
    title: "Notification preferences",
    summary: "Which events send messages, and how.",
    why: "Approvers and crews are told when a permit needs them; this sets the channels used.",
    tips: ["In-app messages work without any setup; add email for approvals if people are often away from the app."],
    optional: true,
    href: "/organisation/notifications",
    measure: async () => active(await notificationPreferencesApi.list()),
  },
];

export type StepStatus = "complete" | "partial" | "skipped" | "todo";

export function stepStatus(step: SetupStep, measure: number | undefined, skipped: readonly string[]): StepStatus {
  if (step.key === "profile" ? measure === 1 : (measure ?? 0) > 0) return "complete";
  if (step.key === "profile" && (measure ?? 0) > 0) return "partial";
  return skipped.includes(step.key) ? "skipped" : "todo";
}

export type SetupAreaKey = "organisation" | "sites" | "permits" | "people" | "preferences";

/** Setup grouped into five work areas; each opens as one page with its lists together. */
export const SETUP_AREAS: { key: SetupAreaKey; title: string; summary: string; steps: SetupStepKey[] }[] = [
  { key: "organisation", title: "Organisation", summary: "Name, legal details and time zone.", steps: ["profile"] },
  {
    key: "sites",
    title: "Sites and equipment",
    summary: "Sites, the work locations under them, who approves each location, and the assets.",
    steps: ["sites", "work-locations", "assets"],
  },
  {
    key: "permits",
    title: "Permit configuration",
    summary: "Permit types, hazards, PPE, checklists, gas testing limits and permit forms.",
    steps: ["permit-types", "hazards", "ppe", "checklists", "gas-testing", "templates"],
  },
  {
    key: "people",
    title: "People and responsibilities",
    summary: "Who approves, who signs in with which role, and who can be named on permits.",
    steps: ["workflows", "users", "employees", "agencies", "contractors", "competencies"],
  },
  { key: "preferences", title: "Notifications", summary: "Which events send messages, and how.", steps: ["notifications"] },
];

export function areaOf(step: SetupStepKey): SetupAreaKey {
  return SETUP_AREAS.find((area) => area.steps.includes(step))!.key;
}

/**
 * The configuration checklist: required steps with nothing recorded, and steps that could not be
 * checked (their request failed). An empty list is not permission to work; submission and approval
 * still apply their own checks.
 */
export function configurationGaps(measures: Partial<Record<SetupStepKey, number>>) {
  const required = SETUP_STEPS.filter((step) => !step.optional);
  return {
    missing: required.filter((step) => measures[step.key] !== undefined && stepStatus(step, measures[step.key], []) !== "complete"),
    unknown: SETUP_STEPS.filter((step) => measures[step.key] === undefined),
  };
}

/** Measures the given steps; a step whose request fails is left out rather than counted as empty. */
export async function measureSteps(keys: SetupStepKey[] = SETUP_STEPS.map((s) => s.key)) {
  const results = await Promise.allSettled(keys.map((key) => SETUP_STEPS.find((s) => s.key === key)!.measure()));
  const measures: Partial<Record<SetupStepKey, number>> = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled") measures[keys[i]] = result.value;
  });
  return measures;
}
