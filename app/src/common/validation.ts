/** Text rules shared by DTOs; the web forms mirror them in frontend/src/lib/validation.ts. */

/** At least one letter; letters, digits, spaces and . , ' & ( ) - / only. */
export const NAME_REGEX = /^(?=.*\p{L})[\p{L}\p{N} .,'&()\-/]+$/u;
export const NAME_MESSAGE = (field: string) =>
  `${field} must contain letters and only letters, digits, spaces and . , ' & ( ) - /`;

/** "+<country code> <national number>", e.g. +91 9876543210. */
export const PHONE_REGEX = /^\+\d{1,3} \d{8,10}$/;
export const PHONE_MESSAGE = 'phone must be a country code and number, e.g. +91 9876543210';

/** Free text (descriptions, findings): empty, or words with at least one letter; never links. */
export const TEXT_REGEX = /^(?![\s\S]*(?:https?:\/\/|www\.))(?:[\s\S]*\p{L}[\s\S]*)?$/u;
export const TEXT_MESSAGE = (field: string) => `${field} must be written in words and cannot contain links`;

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
  console.log('validation ok');
}
