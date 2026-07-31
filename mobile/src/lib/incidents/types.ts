export type IncidentType = "incident" | "near_miss" | "unsafe_condition";
export type IncidentStatus =
  | "draft"
  | "open"
  | "investigating"
  | "pending_verification"
  | "verified"
  | "closed";

export type Incident = {
  id: string;
  reference: string;
  incidentType: IncidentType;
  status: IncidentStatus;
  title: string;
  description: string;
  occurredAt: string;
};

export type IncidentDetail = {
  incident: Incident;
  evidence: Array<{ id: string; fileName: string; fileSize: number }>;
};

export type CreateIncidentPayload = {
  incidentType: IncidentType;
  title: string;
  description: string;
  locationDescription?: string;
  occurredAt: string;
  permitIds?: string[];
  submit?: boolean;
};

export type AssignInvestigationPayload = {
  investigatorId: string;
};

export type RootCausePayload = {
  description: string;
};

export type CorrectiveActionPayload = {
  title: string;
  ownerId: string;
  dueDate: string;
};

export type VerifyIncidentPayload = {
  correctiveActionsConfirmed: boolean;
  preventiveActionsReviewed: boolean;
  comments?: string;
};

export type CloseIncidentPayload = {
  comments?: string;
};
