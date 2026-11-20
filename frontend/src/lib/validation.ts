/**
 * Field rules shared by forms. The API enforces the same rules (app/src/common/validation.ts);
 * these give the message at the field before the request is sent.
 */

/** Names: at least one letter; letters, digits, spaces and . , ' & ( ) - / only. For the HTML pattern attribute (v flag). */
export const NAME_PATTERN = String.raw`(?=.*\p{L})[\p{L}\p{N} .,'\&\(\)\-\/]+`;
export const NAME_REGEX = /^(?=.*\p{L})[\p{L}\p{N} .,'&()\-/]+$/u;
export const NAME_HINT = "Use letters (numbers alone are not a name). Allowed: letters, digits, spaces and . , ' & ( ) - /";
export const NAME_MESSAGE = (field: string = "name") =>
  `${field} must contain letters and only letters, digits, spaces and . , ' & ( ) - /`;

/** "+<country code> <national number>", e.g. +91 9876543210. */
export const PHONE_REGEX = /^\+\d{1,3} \d{8,10}$/;
export const PHONE_PATTERN = String.raw`\+\d{1,3} \d{8,10}`;
export const PHONE_MESSAGE = "phone must be a country code and number, e.g. +91 9876543210";
export const PHONE_HINT = "Use +<country-code> <number>, e.g. +91 9876543210";

/** Free text (descriptions, findings, comments): empty, or words with at least one letter; never links. */
export const TEXT_REGEX = /^(?![\s\S]*(?:https?:\/\/|www\.))(?:\s*|[\s\S]*\p{L}[\s\S]*)$/u;
export const TEXT_MESSAGE = (field: string = "field") => `${field} must be written in words and cannot contain links`;
export const TEXT_HINT = "Must be written in words and cannot contain links";

/** PIN / postal codes: letters and digits (allowed separators: spaces and hyphens), up to 32 chars. */
export const PIN_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,31}$/u;
export const PIN_PATTERN = String.raw`[\p{L}\p{N}][\p{L}\p{N} \-]{0,31}`;
export const PIN_MESSAGE = (field: string = "pin") => `${field} must be letters or digits (up to 32 characters)`;
export const PIN_HINT = "Letters, digits, spaces and hyphens only (up to 32 characters)";

/** Codes/identifiers (site code, asset tag, etc.): start with letter or digit. */
export const CODE_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/]{0,63}$/u;
export const CODE_PATTERN = String.raw`[\p{L}\p{N}][\p{L}\p{N} ._\-/]{0,63}`;
export const CODE_MESSAGE = (field: string = "code") =>
  `${field} must start with a letter or digit, allowed: letters, digits, spaces, dots, underscores, dashes, slashes`;
export const CODE_HINT = "Start with letter or digit; allowed: letters, digits, spaces, dots, underscores, dashes, slashes";

/** Standard email address. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_PATTERN = String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`;
export const EMAIL_MESSAGE = (field: string = "email") => `${field} must be a valid email address`;
export const EMAIL_HINT = "Enter a valid email address";

/** Strong password policy target (#306): upper, lower, number, special character, min 8 chars. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
export const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number and a special character";
export const PASSWORD_HINT = "At least 8 characters with uppercase, lowercase, a number and a special character";

/** UUID format. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UUID_MESSAGE = (field: string = "id") => `${field} must be a valid UUID`;

/** Dialling codes offered on phone fields, with the national number length for each. India first. */
export const PHONE_COUNTRIES = [
  { code: "+91", label: "India +91", digits: 10 },
  { code: "+971", label: "UAE +971", digits: 9 },
  { code: "+966", label: "Saudi Arabia +966", digits: 9 },
  { code: "+974", label: "Qatar +974", digits: 8 },
  { code: "+968", label: "Oman +968", digits: 8 },
  { code: "+965", label: "Kuwait +965", digits: 8 },
  { code: "+973", label: "Bahrain +973", digits: 8 },
  { code: "+65", label: "Singapore +65", digits: 8 },
  { code: "+61", label: "Australia +61", digits: 9 },
  { code: "+44", label: "UK +44", digits: 10 },
  { code: "+1", label: "US/Canada +1", digits: 10 },
] as const;

/** "+91 9876543210" → { code: "+91", number: "9876543210" }. Anything else keeps the default code. */
export function splitPhone(value: string | null | undefined): { code: string; number: string } {
  // The number may be empty: a new form holds just the country code ("+91 "), which is not a number.
  const match = /^(\+\d{1,3})\s*(\d*)$/.exec((value ?? "").trim());
  if (match && PHONE_COUNTRIES.some((c) => c.code === match[1])) return { code: match[1], number: match[2] };
  return { code: PHONE_COUNTRIES[0].code, number: (value ?? "").replace(/\D/g, "") };
}

export type SharedFieldCategory = "name" | "phone" | "text" | "email" | "pin" | "password" | "code" | "uuid";

/**
 * Validates a value against its shared category when a value is present.
 * Returns null if the value is empty/absent (required checks are separate),
 * or null if valid. Returns an error message if invalid.
 */
export function validateField(
  category: SharedFieldCategory,
  value: string | null | undefined,
  fieldLabel?: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = typeof value === "string" ? value : String(value);
  if (!str.trim()) return null; // Empty or whitespace-only is handled by required checks

  switch (category) {
    case "name":
      return NAME_REGEX.test(str.trim()) ? null : NAME_MESSAGE(fieldLabel ?? "Name");
    case "phone": {
      const trimmed = str.trim();
      const match = /^(\+\d{1,3})\s*(\d+)$/.exec(trimmed);
      if (!match) return PHONE_MESSAGE;
      const country = PHONE_COUNTRIES.find((c) => c.code === match[1]);
      if (country && match[2].length !== country.digits) {
        return `${country.label} numbers must have ${country.digits} digits`;
      }
      return PHONE_REGEX.test(trimmed) ? null : PHONE_MESSAGE;
    }
    case "text":
      return TEXT_REGEX.test(str.trim()) ? null : TEXT_MESSAGE(fieldLabel ?? "This field");
    case "email":
      return EMAIL_REGEX.test(str.trim()) ? null : EMAIL_MESSAGE(fieldLabel ?? "Email");
    case "pin":
      return PIN_REGEX.test(str.trim()) ? null : PIN_MESSAGE(fieldLabel ?? "PIN");
    case "password":
      return PASSWORD_REGEX.test(str) ? null : PASSWORD_MESSAGE;
    case "code":
      return CODE_REGEX.test(str.trim()) ? null : CODE_MESSAGE(fieldLabel ?? "Code");
    case "uuid":
      return UUID_REGEX.test(str.trim()) ? null : UUID_MESSAGE(fieldLabel ?? "ID");
    default:
      return null;
  }
}

export const validateName = (val: string | null | undefined, label?: string) => validateField("name", val, label);
export const validatePhone = (val: string | null | undefined) => validateField("phone", val);
export const validateText = (val: string | null | undefined, label?: string) => validateField("text", val, label);
export const validateEmail = (val: string | null | undefined, label?: string) => validateField("email", val, label);
export const validatePin = (val: string | null | undefined, label?: string) => validateField("pin", val, label);
export const validatePassword = (val: string | null | undefined) => validateField("password", val);
export const validateCode = (val: string | null | undefined, label?: string) => validateField("code", val, label);
export const validateUuid = (val: string | null | undefined, label?: string) => validateField("uuid", val, label);
