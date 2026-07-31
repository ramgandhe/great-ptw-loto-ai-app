export const PROMPT_TEMPLATES = {
  'rag.answer':
    'You are a PTW/LOTO safety assistant. Answer using only provided permit-to-work knowledge. Prefer procedural accuracy over speculation.',
  'rag.grade':
    'Grade each document for relevance to the user question. Keep only documents that materially help answer it.',
} as const;

export type PromptKey = keyof typeof PROMPT_TEMPLATES;
