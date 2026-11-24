export type ActionValidationResult = {
  valid: boolean;
  field?: 'title' | 'ownerId' | 'dueDate';
  message?: string;
};

export function validateCorrectiveAction(input: {
  title: string;
  ownerId: string;
  dueDate?: string;
}): ActionValidationResult {
  if (!input.title || !input.title.trim()) {
    return { valid: false, field: 'title', message: 'Title is required' };
  }
  if (!input.ownerId || !input.ownerId.trim()) {
    return { valid: false, field: 'ownerId', message: 'Please select an Owner' };
  }
  if (!input.dueDate || !input.dueDate.trim()) {
    return { valid: false, field: 'dueDate', message: 'Due date is required' };
  }
  return { valid: true };
}

export function validatePreventiveAction(input: {
  title: string;
  ownerId: string;
  dueDate?: string;
}): ActionValidationResult {
  if (!input.title || !input.title.trim()) {
    return { valid: false, field: 'title', message: 'Title is required' };
  }
  if (!input.ownerId || !input.ownerId.trim()) {
    return { valid: false, field: 'ownerId', message: 'Please select an Owner' };
  }
  return { valid: true };
}

export type IncidentReportFormValues = {
  title: string;
  description: string;
  siteId: string;
  workLocationId: string;
  occurredAt: string;
};

export type IncidentReportFieldErrors = {
  title?: string;
  description?: string;
  siteId?: string;
  workLocationId?: string;
  occurredAt?: string;
};

export function validateIncidentReport(
  values: IncidentReportFormValues,
  isSubmit: boolean,
): IncidentReportFieldErrors {
  const errors: IncidentReportFieldErrors = {};

  if (!values.title || !values.title.trim()) {
    errors.title = 'Title is required';
  }

  if (!values.description || !values.description.trim()) {
    errors.description = 'Description is required';
  }

  if (!values.occurredAt || !values.occurredAt.trim() || isNaN(new Date(values.occurredAt).getTime())) {
    errors.occurredAt = 'Date and time of incident are required';
  }

  if (isSubmit) {
    if (!values.siteId || !values.siteId.trim()) {
      errors.siteId = 'Site is required';
    }
    if (!values.workLocationId || !values.workLocationId.trim()) {
      errors.workLocationId = 'Work location is required';
    }
  }

  return errors;
}
