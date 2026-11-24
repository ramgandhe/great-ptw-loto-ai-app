/** Text rules shared by DTOs; the web forms mirror them in frontend/src/lib/validation.ts. */

/** At least one letter; letters, digits, spaces and . , ' & ( ) - / only. Used for person/signed names. */
export const NAME_REGEX = /^(?=.*\p{L})[\p{L}\p{N} .,'&()\-/]+$/u;
export const NAME_MESSAGE = (field: string = 'name') =>
  `${field} must contain letters and only letters, digits, spaces and . , ' & ( ) - /`;

/** Permit / job title: letters, digits, spaces and . , ' & # ( ) : - / (at least one letter or digit). */
export const TITLE_REGEX = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} .,'&#():/-]{1,255}$/u;
export const TITLE_MESSAGE = (field: string = 'title') =>
  `${field} must contain letters or digits and only letters, digits, spaces and . , ' & # ( ) : - /`;

/** Standard phone: "+<country code> <national number>", e.g. +91 9876543210. */
export const PHONE_REGEX = /^\+\d{1,3} \d{8,10}$/;
export const PHONE_MESSAGE = 'phone must be a country code and number, e.g. +91 9876543210';

/** Emergency contact phone: accepts standard +CC numbers as well as local numbers, extensions or shortcodes (3-32 chars). */
export const EMERGENCY_PHONE_REGEX = /^(?=(?:.*\d){3,})\+?[\d\s\-()./]{3,32}$/;
export const EMERGENCY_PHONE_MESSAGE = 'emergency phone must be a valid phone number (at least 3 digits)';

/** Free text (descriptions, findings, site notes, comments): multi-line text, readings, or procedure links. */
export const TEXT_REGEX = /^[\s\S]*$/;
export const TEXT_MESSAGE = (field: string = 'field') => `${field} contains invalid characters`;

/** PIN / postal codes: letters and digits (allowed separators: spaces and hyphens), up to 32 chars. */
export const PIN_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} -]{0,31}$/u;
export const PIN_MESSAGE = (field: string = 'pin') => `${field} must be letters or digits (up to 32 characters)`;

/** Codes/identifiers (site code, asset tag, etc.): start with letter or digit, allowed: letters, digits, spaces, dots, underscores, dashes, slashes (up to 64 chars). */
export const CODE_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/]{0,63}$/u;
export const CODE_MESSAGE = (field: string = 'code') =>
  `${field} must start with a letter or digit, allowed: letters, digits, spaces, dots, underscores, dashes, slashes`;

/** Standard email address. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MESSAGE = (field: string = 'email') => `${field} must be a valid email address`;

/** Strong password policy target (#306): upper, lower, number, special character, min 8 chars. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
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
  ok(TITLE_REGEX, 'Hot work: Unit 3', true);
  ok(TITLE_REGEX, 'PTW #12', true);
  ok(TITLE_REGEX, 'Unit 3/Pump 2: Check & Clean', true);
  ok(TITLE_REGEX, '12345', true);
  ok(TITLE_REGEX, '   ', false);
  ok(PHONE_REGEX, '+91 9876543210', true);
  ok(PHONE_REGEX, '98765abc', false);
  ok(EMERGENCY_PHONE_REGEX, '+91 9876543210', true);
  ok(EMERGENCY_PHONE_REGEX, '9876543210', true);
  ok(EMERGENCY_PHONE_REGEX, '022-24301234', true);
  ok(EMERGENCY_PHONE_REGEX, '911', true);
  ok(EMERGENCY_PHONE_REGEX, '12', false);
  ok(TEXT_REGEX, '', true);
  ok(TEXT_REGEX, 'Valve seat worn', true);
  ok(TEXT_REGEX, '123456', true);
  ok(TEXT_REGEX, 'see https://x.io', true);
  ok(TEXT_REGEX, 'visit www.x.io', true);
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
