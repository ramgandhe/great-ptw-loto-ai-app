/**
 * Field rules shared by forms. The API enforces the same rules (app/src/common/validation.ts);
 * these give the message at the field before the request is sent.
 */

/** Names: at least one letter; letters, digits, spaces and . , ' & ( ) - / only. For the HTML pattern attribute (v flag). */
export const NAME_PATTERN = String.raw`(?=.*\p{L})[\p{L}\p{N} .,'\&\(\)\-\/]+`;
export const NAME_HINT = "Use letters (numbers alone are not a name). Allowed: letters, digits, spaces and . , ' & ( ) - /";

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
