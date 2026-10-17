export const PERMIT_LIFECYCLE_PHASES = [
  {
    sequence: 1,
    name: "Receiver initiation",
    participantRole: "permit-receiver",
    kind: "collaboration",
  },
  {
    sequence: 2,
    name: "Executor on-site details",
    participantRole: "permit-operator",
    kind: "collaboration",
  },
  {
    sequence: 3,
    name: "Approver initial review",
    participantRole: "permit-approver",
    kind: "approval",
  },
  {
    sequence: 4,
    name: "Executor pre-work confirmation",
    participantRole: "permit-operator",
    kind: "execution",
  },
  {
    sequence: 5,
    name: "Receiver completion approval",
    participantRole: "permit-receiver",
    kind: "closure",
  },
  {
    sequence: 6,
    name: "Approver final approval",
    participantRole: "permit-approver",
    kind: "closure",
  },
] as const;

export type LifecyclePhaseStatus = "completed" | "active" | "pending";

export type LifecyclePhaseState = {
  sequence: number;
  name: string;
  participantRole: string;
  kind: string;
  status: LifecyclePhaseStatus;
};

export function resolveLifecyclePhases(input: {
  permitStatus: string;
  draftStep?: number;
  activeApprovalRole?: string | null;
}): LifecyclePhaseState[] {
  const { permitStatus, draftStep = 0, activeApprovalRole } = input;

  return PERMIT_LIFECYCLE_PHASES.map((phase) => {
    let status: LifecyclePhaseStatus = "pending";

    if (permitStatus === "draft" || permitStatus === "deferred" || permitStatus === "rejected") {
      if (phase.sequence === 1) {
        status = draftStep >= 1 ? "completed" : draftStep === 0 ? "active" : "pending";
      } else if (phase.sequence === 2) {
        status = draftStep >= 4 ? "completed" : draftStep >= 2 ? "active" : "pending";
      }
    } else if (permitStatus === "pending_approval") {
      if (phase.sequence <= 2) status = "completed";
      if (phase.sequence === 3) status = activeApprovalRole === "permit-approver" ? "active" : "pending";
    } else if (
      permitStatus === "approved" ||
      permitStatus === "active" ||
      permitStatus === "suspended"
    ) {
      if (phase.sequence <= 3) status = "completed";
      if (phase.sequence === 4) status = "active";
    } else if (permitStatus === "pending_closure") {
      if (phase.sequence <= 4) status = "completed";
      if (phase.sequence === 5) status = "active";
    } else if (permitStatus === "closed") {
      status = "completed";
    }

    return { ...phase, status };
  });
}
