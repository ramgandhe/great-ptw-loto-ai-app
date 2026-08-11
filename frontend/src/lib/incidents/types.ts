export type IncidentType = "incident" | "near_miss" | "unsafe_condition";
export type IncidentSeverityPath = "near_miss" | "accident";
export type IncidentStatus =
  | "draft"
  | "open"
  | "investigating"
  | "pending_verification"
  | "verified"
  | "closed";
export type IncidentPriority = "low" | "medium" | "high" | "critical";
export type ActionStatus = "open" | "in_progress" | "completed" | "cancelled";

export type Incident = {
  id: string;
  tenantId: string;
  reference: string;
  incidentType: IncidentType;
  severityPath: IncidentSeverityPath;
  status: IncidentStatus;
  title: string;
  description: string;
  locationDescription: string;
  occurredAt: string;
  priority: IncidentPriority;
  reportedBy: string;
  submittedAt: string | null;
  plantId: string | null;
  locationId: string | null;
  workstationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentEvidence = {
  id: string;
  incidentId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  comment: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type IncidentPermitLink = {
  permitId: string;
  permit: { id: string; title: string; reference: string | null; status: string };
};

export type IncidentDetail = {
  incident: Incident;
  evidence: IncidentEvidence[];
  equipment: Array<{ machineryId: string; machinery: { id: string; name: string; code: string } }>;
  permits: IncidentPermitLink[];
  severityLifecycle?: IncidentSeverityLifecycle | null;
  severityHistory?: IncidentSeverityHistoryEntry[];
};

export type IncidentLifecycleStatus =
  | "awaiting_hod"
  | "continued"
  | "stopped"
  | "auto_terminated";

export type IncidentSeverityLifecycle = {
  id: string;
  incidentId: string;
  severityPath: IncidentSeverityPath;
  lifecycleStatus: IncidentLifecycleStatus;
  hodDecision: "continue" | "stop" | null;
  hodDecidedAt: string | null;
  hodDecisionComments: string | null;
  permitsCancelledAt: string | null;
};

export type IncidentSeverityHistoryEntry = {
  id: string;
  eventType: string;
  actorId: string;
  permitId: string | null;
  createdAt: string;
};

export type Investigation = {
  id: string;
  incidentId: string;
  investigatorId: string;
  status: string;
  dueDate: string | null;
  priority: IncidentPriority;
  assignedAt: string;
};

export type RootCause = {
  id: string;
  methodology: string | null;
  description: string;
  findings: string | null;
};

export type CorrectiveAction = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  dueDate: string;
  status: ActionStatus;
};

export type PreventiveAction = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  dueDate: string | null;
  status: ActionStatus;
};

export type InvestigationDetail = {
  investigation: Investigation;
  rootCauses: RootCause[];
  correctiveActions: CorrectiveAction[];
  preventiveActions: PreventiveAction[];
  history: Array<{ id: string; action: string; createdAt: string }>;
};

export type ClosureHistoryEntry = {
  id: string;
  eventType: string;
  actorId: string | null;
  createdAt: string;
};

export type IncidentHistoryResponse = {
  history: ClosureHistoryEntry[];
  verification: { id: string; incidentId: string } | null;
  closure: { id: string; incidentId: string } | null;
};

export type ArchivedIncident = {
  incident: Incident;
  closedAt: string | null;
};

export type CreateIncidentPayload = {
  incidentType: IncidentType;
  severityPath?: IncidentSeverityPath;
  title: string;
  description: string;
  locationDescription?: string;
  occurredAt: string;
  priority?: IncidentPriority;
  plantId?: string;
  locationId?: string;
  workstationId?: string;
  permitIds?: string[];
  machineryIds?: string[];
  submit?: boolean;
};

export type AssignInvestigationPayload = {
  investigatorId: string;
  dueDate?: string;
  priority?: IncidentPriority;
};

export type RootCausePayload = {
  methodology?: string;
  description: string;
  findings?: string;
};

export type CorrectiveActionPayload = {
  title: string;
  description?: string;
  ownerId: string;
  dueDate: string;
};

export type PreventiveActionPayload = {
  title: string;
  description?: string;
  ownerId: string;
  dueDate?: string;
};

export type VerifyIncidentPayload = {
  correctiveActionsConfirmed: boolean;
  preventiveActionsReviewed: boolean;
  comments?: string;
};

export type CloseIncidentPayload = {
  comments?: string;
};
