/** Text rules shared by DTOs; the web forms mirror them in frontend/src/lib/validation.ts. */

/** At least one letter; letters, digits, spaces and . , ' & ( ) - / only. */
export const NAME_REGEX = /^(?=.*\p{L})[\p{L}\p{N} .,'&()\-/]+$/u;
export const NAME_MESSAGE = (field: string = 'name') =>
  `${field} must contain letters and only letters, digits, spaces and . , ' & ( ) - /`;

/** "+<country code> <national number>", e.g. +91 9876543210. */
export const PHONE_REGEX = /^\+\d{1,3} \d{8,10}$/;
export const PHONE_MESSAGE = 'phone must be a country code and number, e.g. +91 9876543210';

/** Free text (descriptions, findings): empty, or words with at least one letter; never links. */
export const TEXT_REGEX = /^(?![\s\S]*(?:https?:\/\/|www\.))(?:\s*|[\s\S]*\p{L}[\s\S]*)$/u;
export const TEXT_MESSAGE = (field: string = 'field') => `${field} must be written in words and cannot contain links`;

/** PIN / postal codes: letters and digits (allowed separators: spaces and hyphens), up to 32 chars. */
export const PIN_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,31}$/u;
export const PIN_MESSAGE = (field: string = 'pin') => `${field} must be letters or digits (up to 32 characters)`;

/** Codes/identifiers (site code, asset tag, etc.): start with letter or digit, allowed: letters, digits, spaces, dots, underscores, dashes, slashes (up to 64 chars). */
export const CODE_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/]{0,63}$/u;
export const CODE_MESSAGE = (field: string = 'code') =>
  `${field} must start with a letter or digit, allowed: letters, digits, spaces, dots, underscores, dashes, slashes`;

/** Standard email address. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MESSAGE = (field: string = 'email') => `${field} must be a valid email address`;

/** Strong password policy target (#306): upper, lower, number, special character, min 8 chars. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, a number and a special character';

/** UUID v4 / standard UUID format. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UUID_MESSAGE = (field: string = 'id') => `${field} must be a valid UUID`;

// ponytail: self-check, run with `npx ts-node src/common/validation.ts`
if (require.main === module) {
  const ok = (re: RegExp, v: string, want: boolean) => {
    if (re.test(v) !== want) throw new Error(`${re} on ${JSON.stringify(v)} expected ${want}`);
  };
  ok(NAME_REGEX, 'Ravi Kumar', true);
  ok(NAME_REGEX, "O'Neil & Sons (Pvt) Ltd.", true);
  ok(NAME_REGEX, 'Unit 2', true);
  ok(NAME_REGEX, '12345', false);
  ok(NAME_REGEX, 'abc<script>', false);
  ok(PHONE_REGEX, '+91 9876543210', true);
  ok(PHONE_REGEX, '98765abc', false);
  ok(TEXT_REGEX, '', true);
  ok(TEXT_REGEX, 'Valve seat worn', true);
  ok(TEXT_REGEX, '123456', false);
  ok(TEXT_REGEX, 'see https://x.io', false);
  ok(TEXT_REGEX, 'visit www.x.io', false);
  ok(PIN_REGEX, '560001', true);
  ok(PIN_REGEX, 'SW1A 1AA', true);
  ok(CODE_REGEX, 'SITE-01', true);
  ok(CODE_REGEX, '-BAD', false);
  ok(EMAIL_REGEX, 'user@example.com', true);
  ok(EMAIL_REGEX, 'invalid', false);
  ok(PASSWORD_REGEX, 'StrongP@ss1', true);
  ok(PASSWORD_REGEX, 'weakpass', false);
  console.log('validation ok');
}
