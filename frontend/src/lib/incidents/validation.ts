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
