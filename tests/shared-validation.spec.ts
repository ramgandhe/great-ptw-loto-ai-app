import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  NAME_REGEX,
  TITLE_REGEX,
  PHONE_REGEX,
  EMERGENCY_PHONE_REGEX,
  TEXT_REGEX,
  PIN_REGEX,
  CODE_REGEX,
  EMAIL_REGEX,
  PASSWORD_REGEX,
  UUID_REGEX,
} from '../app/src/common/validation';
import {
  validateField,
  validateName,
  validateTitle,
  validatePhone,
  validateEmergencyPhone,
  validateText,
  validateEmail,
  validatePin,
  validatePassword,
  validateCode,
  validateUuid,
  NAME_REGEX as FE_NAME_REGEX,
  TITLE_REGEX as FE_TITLE_REGEX,
  PHONE_REGEX as FE_PHONE_REGEX,
  EMERGENCY_PHONE_REGEX as FE_EMERGENCY_PHONE_REGEX,
  TEXT_REGEX as FE_TEXT_REGEX,
  PIN_REGEX as FE_PIN_REGEX,
  CODE_REGEX as FE_CODE_REGEX,
  EMAIL_REGEX as FE_EMAIL_REGEX,
  PASSWORD_REGEX as FE_PASSWORD_REGEX,
  UUID_REGEX as FE_UUID_REGEX,
} from '@/lib/validation';
import { CreatePermitDto } from '../app/src/modules/permit/dto/create-permit.dto';
import { UpdatePermitDto } from '../app/src/modules/permit/dto/update-permit.dto';
import { SaveDraftDto, SubmitPermitDto } from '../app/src/modules/permit/dto/save-draft.dto';
import { SignInDto, FirstPasswordDto, PasswordResetCompleteDto } from '../app/src/modules/auth/dto/sign-in.dto';
import { RejectPermitDto } from '../app/src/modules/approval/dto/reject-permit.dto';
import { DeferPermitDto } from '../app/src/modules/approval/dto/defer-permit.dto';
import { ApprovalCommentDto } from '../app/src/modules/approval/dto/approval-comment.dto';
import { CreateSiteDto, CreateAssetDto } from '../app/src/modules/place/dto/place.dto';
import { DefaultPpeItemDto, DefaultPermitTypeDto, DefaultHazardDto } from '../app/src/modules/platform/dto/platform-defaults.dto';

describe('Shared Field Validation (Issue #341)', () => {
  describe('Client validateField helpers', () => {
    it('allows absent/empty values (format validation only enforces when value is present)', () => {
      expect(validateField('name', '')).toBeNull();
      expect(validateField('name', null)).toBeNull();
      expect(validateField('name', undefined)).toBeNull();
      expect(validateField('name', '   ')).toBeNull();
      expect(validateField('title', '')).toBeNull();
      expect(validateField('title', null)).toBeNull();
      expect(validateField('title', '   ')).toBeNull();
      expect(validateField('text', '')).toBeNull();
      expect(validateField('phone', '')).toBeNull();
      expect(validateField('emergencyPhone', '')).toBeNull();
      expect(validateField('emergencyPhone', null)).toBeNull();
      expect(validateField('emergencyPhone', '   ')).toBeNull();
      expect(validateField('email', '')).toBeNull();
      expect(validatePin('')).toBeNull();
      expect(validateField('code', '')).toBeNull();
      expect(validateField('password', '')).toBeNull();
      expect(validateField('uuid', '')).toBeNull();
    });

    it('validates name category (strictly for personal/signed names)', () => {
      expect(validateName('John Doe')).toBeNull();
      expect(validateName("O'Connor & Sons - Line/1 (Main)")).toBeNull();
      expect(validateName('123456')).not.toBeNull();
      expect(validateName('!@#$%')).not.toBeNull();
    });

    it('validates title category (allows normal job wording with colon, hash, slash, and digits)', () => {
      expect(validateTitle('Hot work: Unit 3')).toBeNull();
      expect(validateTitle('PTW #12')).toBeNull();
      expect(validateTitle('Line-1/A: Pump Repair & Inspection')).toBeNull();
      expect(validateTitle('12345')).toBeNull();
      expect(validateTitle('Unit 2')).toBeNull();
      expect(validateTitle('!@#$%')).not.toBeNull();
      expect(validateTitle('<script>')).not.toBeNull();
    });

    it('validates standard phone category', () => {
      expect(validatePhone('')).toBeNull();
      expect(validatePhone('   ')).toBeNull();
      expect(validatePhone(undefined)).toBeNull();
      expect(validatePhone(null)).toBeNull();

      expect(validatePhone('+91 9876543210')).toBeNull();
      expect(validatePhone('+1 2025550123')).toBeNull();
      expect(validatePhone('9876543210')).not.toBeNull();
      expect(validatePhone('+91 123')).not.toBeNull();
    });

    it('validates emergencyPhone category (accepts existing numbers on file in other formats and shortcodes)', () => {
      expect(validateEmergencyPhone('')).toBeNull();
      expect(validateEmergencyPhone('   ')).toBeNull();
      expect(validateEmergencyPhone(undefined)).toBeNull();

      // Standard and national formats
      expect(validateEmergencyPhone('+91 9876543210')).toBeNull();
      expect(validateEmergencyPhone('+1-202-555-0123')).toBeNull();
      expect(validateEmergencyPhone('9876543210')).toBeNull();
      expect(validateEmergencyPhone('022-24301234')).toBeNull();
      expect(validateEmergencyPhone('(022) 24301234')).toBeNull();
      expect(validateEmergencyPhone('+44 20 7946 0958')).toBeNull();

      // Shortcodes / extensions
      expect(validateEmergencyPhone('911')).toBeNull();
      expect(validateEmergencyPhone('112')).toBeNull();
      expect(validateEmergencyPhone('100')).toBeNull();

      // Invalid entries (< 3 digits, letters, scripts)
      expect(validateEmergencyPhone('12')).not.toBeNull();
      expect(validateEmergencyPhone('abc')).not.toBeNull();
      expect(validateEmergencyPhone('<script>')).not.toBeNull();
    });

    it('validates text category (allows digits-only readings and procedure links)', () => {
      expect(validateText('Standard safety notes.')).toBeNull();
      expect(validateText('Detailed findings with 123 items.')).toBeNull();
      expect(validateText('123456')).toBeNull(); // Digits-only reading
      expect(validateText('101.3 kPa')).toBeNull();
      expect(validateText('Check procedure at https://wiki.plant.internal/sop-12')).toBeNull(); // Procedure link
      expect(validateText('Refer to http://insecure.internal/sop')).toBeNull();
      expect(validateText('See www.osha.gov/standards')).toBeNull();
    });

    it('validates email category', () => {
      expect(validateEmail('user@example.com')).toBeNull();
      expect(validateEmail('not-an-email')).not.toBeNull();
      expect(validateEmail('missing@domain')).not.toBeNull();
    });

    it('validates pin category', () => {
      expect(validatePin('560001')).toBeNull();
      expect(validatePin('SW1A 1AA')).toBeNull();
      expect(validatePin('123-456')).toBeNull();
      expect(validatePin('!@#$')).not.toBeNull();
    });

    it('validates strong password category (#306)', () => {
      expect(validatePassword('StrongP@ss1')).toBeNull();
      expect(validatePassword('Abc!12345')).toBeNull();
      expect(validatePassword('weakpass')).not.toBeNull(); // no upper, number, special
      expect(validatePassword('SHORT1!')).not.toBeNull(); // < 8 chars
      expect(validatePassword('NoSpecial123')).not.toBeNull();
      expect(validatePassword('NoNumber!@#')).not.toBeNull();
      expect(validatePassword('nouppercase1!@')).not.toBeNull();
      expect(validatePassword('NOLOWERCASE1!@')).not.toBeNull();
    });

    it('validates code category', () => {
      expect(validateCode('SITE-01')).toBeNull();
      expect(validateCode('ASSET.PUMP_02/B')).toBeNull();
      expect(validateCode('-BAD-START')).not.toBeNull();
      expect(validateCode('.BAD-START')).not.toBeNull();
    });

    it('validates uuid category', () => {
      expect(validateUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBeNull();
      expect(validateUuid('not-a-uuid')).not.toBeNull();
    });
  });

  describe('Regex symmetry between frontend and backend', () => {
    it('ensures all regex definitions match identically in source and flags', () => {
      const pairs = [
        ['NAME', NAME_REGEX, FE_NAME_REGEX],
        ['TITLE', TITLE_REGEX, FE_TITLE_REGEX],
        ['PHONE', PHONE_REGEX, FE_PHONE_REGEX],
        ['EMERGENCY_PHONE', EMERGENCY_PHONE_REGEX, FE_EMERGENCY_PHONE_REGEX],
        ['TEXT', TEXT_REGEX, FE_TEXT_REGEX],
        ['PIN', PIN_REGEX, FE_PIN_REGEX],
        ['CODE', CODE_REGEX, FE_CODE_REGEX],
        ['EMAIL', EMAIL_REGEX, FE_EMAIL_REGEX],
        ['PASSWORD', PASSWORD_REGEX, FE_PASSWORD_REGEX],
        ['UUID', UUID_REGEX, FE_UUID_REGEX],
      ] as const;

      for (const [, be, fe] of pairs) {
        expect(be.source).toBe(fe.source);
        expect(be.flags).toBe(fe.flags);
      }
    });

    it('ensures behavioral consistency across test vectors (fails if either copy changes independently)', () => {
      const vectors = [
        {
          reBe: TITLE_REGEX,
          reFe: FE_TITLE_REGEX,
          samples: ['Hot work: Unit 3', 'PTW #12', 'Line-1/A: Pump Repair & Inspection', '12345', 'Unit 2', '<script>', '!@#$', '   '],
        },
        {
          reBe: EMERGENCY_PHONE_REGEX,
          reFe: FE_EMERGENCY_PHONE_REGEX,
          samples: ['+91 9876543210', '+1-202-555-0123', '9876543210', '022-24301234', '(022) 24301234', '911', '112', '100', '12', 'abc', '<script>', ''],
        },
        {
          reBe: TEXT_REGEX,
          reFe: FE_TEXT_REGEX,
          samples: ['Safe work procedure', '123456', '101.3 kPa', 'https://wiki.plant.internal/sop', 'http://docs', 'www.osha.gov', ''],
        },
        {
          reBe: NAME_REGEX,
          reFe: FE_NAME_REGEX,
          samples: ['John Doe', "O'Connor & Sons - Line/1 (Main)", '12345', '!@#$', ''],
        },
        {
          reBe: CODE_REGEX,
          reFe: FE_CODE_REGEX,
          samples: ['SITE-01', 'ASSET.PUMP_02/B', '-BAD-START', '.BAD-START', ''],
        },
        {
          reBe: PIN_REGEX,
          reFe: FE_PIN_REGEX,
          samples: ['560001', 'SW1A 1AA', '123-456', '!@#$', ''],
        },
        {
          reBe: EMAIL_REGEX,
          reFe: FE_EMAIL_REGEX,
          samples: ['user@example.com', 'invalid', 'missing@domain', ''],
        },
        {
          reBe: PASSWORD_REGEX,
          reFe: FE_PASSWORD_REGEX,
          samples: ['StrongP@ss1', 'Abc!12345', 'weakpass', 'SHORT1!', 'NoSpecial123', 'NoNumber!@#', 'nouppercase1!@', 'NOLOWERCASE1!@'],
        },
        {
          reBe: UUID_REGEX,
          reFe: FE_UUID_REGEX,
          samples: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'invalid-uuid', ''],
        },
      ];

      for (const { reBe, reFe, samples } of vectors) {
        for (const sample of samples) {
          expect(reBe.test(sample)).toBe(reFe.test(sample));
        }
      }
    });
  });

  describe('Emergency phone formats and blank-to-undefined verification', () => {
    it('accepts all existing emergency number formats on file and shortcodes', () => {
      const validFormats = [
        '+91 9876543210',    // Standard international with country code and space
        '+919876543210',     // International without space
        '+1-202-555-0123',   // International with dashes
        '9876543210',        // 10-digit national mobile without country code
        '022-24301234',      // Landline with area code and dash
        '(022) 24301234',    // Landline with area code in parentheses
        '(202) 555-0123',    // US standard with parentheses
        '+44 20 7946 0958',  // UK standard
        '100',               // Emergency police (India)
        '101',               // Emergency fire
        '112',               // Standard emergency shortcode (EU/India)
        '911',               // Emergency shortcode (US)
        '999',               // Emergency shortcode (UK)
        '022.24301234',      // Dot separated
        '022/24301234',      // Slash separated
      ];
      for (const phone of validFormats) {
        expect(validateEmergencyPhone(phone)).toBeNull();
        expect(EMERGENCY_PHONE_REGEX.test(phone)).toBe(true);
      }

      const invalidFormats = [
        '12',        // Too short (< 3 digits)
        '1',         // Single digit
        'abc',       // Letters only
        'phone-12',  // Letters mixed with digits
        '<script>',  // XSS tags
        '+',         // Leading plus only
      ];
      for (const phone of invalidFormats) {
        expect(validateEmergencyPhone(phone)).not.toBeNull();
        expect(EMERGENCY_PHONE_REGEX.test(phone)).toBe(false);
      }
    });

    it('verifies blank-to-undefined behavior across form payload and backend DTOs', async () => {
      // 1. Form payload serialization (mirrors frontend formToSavePayload: form.emergencyPhone.trim() || undefined)
      const normalizePayloadPhone = (val: string) => val.trim() || undefined;
      expect(normalizePayloadPhone('')).toBeUndefined();
      expect(normalizePayloadPhone('   ')).toBeUndefined();
      expect(normalizePayloadPhone('+91 9876543210')).toBe('+91 9876543210');

      const payload = {
        title: 'Test Permit',
        emergencyPhone: normalizePayloadPhone('   '),
      };
      const jsonBlank = JSON.parse(JSON.stringify(payload));
      expect('emergencyPhone' in jsonBlank).toBe(false);
      expect(jsonBlank.title).toBe('Test Permit');

      // 2. CreatePermitDto with various blank/optional representations
      const createDto = new CreatePermitDto();
      createDto.permitTypeId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      createDto.title = 'Hot work: Unit 3';

      createDto.emergencyPhone = undefined;
      expect((await validate(createDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      createDto.emergencyPhone = '';
      expect((await validate(createDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      createDto.emergencyPhone = '   ';
      expect((await validate(createDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      // 3. UpdatePermitDto with blank representations
      const updateDto = new UpdatePermitDto();
      updateDto.emergencyPhone = undefined;
      expect((await validate(updateDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      updateDto.emergencyPhone = '';
      expect((await validate(updateDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      updateDto.emergencyPhone = '   ';
      expect((await validate(updateDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      // 4. SaveDraftDto with blank representations
      const draftDto = new SaveDraftDto();
      draftDto.expectedRevision = 1;

      draftDto.emergencyPhone = undefined;
      expect((await validate(draftDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      draftDto.emergencyPhone = '';
      expect((await validate(draftDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);

      draftDto.emergencyPhone = '   ';
      expect((await validate(draftDto)).some((e) => e.property === 'emergencyPhone')).toBe(false);
    });
  });

  describe('Backend DTO class-validator enforcement', () => {
    it('validates CreatePermitDto with dedicated title rule, relaxed emergencyPhone, and procedure links', async () => {
      const dto = new CreatePermitDto();
      dto.permitTypeId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      dto.title = 'Hot work: Unit 3';
      dto.workScope = 'Check details at https://wiki.plant.internal/sop';
      dto.siteNotes = '123456';
      dto.emergencyPhone = '9876543210';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Job title with hash and slash
      dto.title = 'PTW #12 / Line Overhaul';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(false);

      // Digits-only title
      dto.title = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(false);

      // Emergency number with shortcode or local landline
      dto.emergencyPhone = '911';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      dto.emergencyPhone = '022-24301234';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      // Empty string emergencyPhone is accepted as optional
      dto.emergencyPhone = '';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      dto.emergencyPhone = undefined;
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      // Invalid title with script tags is rejected
      dto.title = '<script>';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);

      // Invalid emergency phone (< 3 digits or non-phone chars)
      dto.title = 'Valid Work Title';
      dto.emergencyPhone = '12';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(true);
    });

    it('validates UpdatePermitDto fields', async () => {
      const dto = new UpdatePermitDto();
      dto.title = 'Hot work: Unit 3';
      dto.safetyApprovalComment = 'Procedure reviewed: https://wiki.plant.internal';
      dto.safetyApprovalSignedName = 'Officer Jane';
      dto.emergencyPhone = '(022) 24301234';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Digits-only comment
      dto.safetyApprovalComment = '101.3';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'safetyApprovalComment')).toBe(false);

      // Empty string emergencyPhone is optional
      dto.emergencyPhone = '';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      // Signed name must remain on NAME_REGEX (reject digits only)
      dto.safetyApprovalSignedName = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'safetyApprovalSignedName')).toBe(true);
    });

    it('validates SaveDraftDto emergencyPhone field', async () => {
      const dto = new SaveDraftDto();
      dto.expectedRevision = 1;

      // Empty emergencyPhone is accepted
      dto.emergencyPhone = undefined;
      let errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      dto.emergencyPhone = '';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      // Valid existing format is accepted
      dto.emergencyPhone = '9876543210';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(false);

      // Invalid emergencyPhone (< 3 digits) is rejected
      dto.emergencyPhone = '12';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(true);
    });

    it('validates SubmitPermitDto signedName strictly with NAME_REGEX', async () => {
      const dto = new SubmitPermitDto();
      dto.expectedRevision = 1;
      dto.signedName = 'Alice Smith';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Digits only is rejected for signed name
      dto.signedName = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'signedName')).toBe(true);

      // Symbols like colons/hashes rejected for signed name
      dto.signedName = 'PTW #12';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'signedName')).toBe(true);
    });

    it('validates sign-in password (no complexity rule) vs new password (strict policy)', async () => {
      // SignInDto accepts simple passwords without complexity rules
      const signIn = new SignInDto();
      signIn.email = 'user@example.com';
      signIn.password = 'simple';
      let errors = await validate(signIn);
      expect(errors).toHaveLength(0);

      signIn.password = '123456';
      errors = await validate(signIn);
      expect(errors).toHaveLength(0);

      // Empty password is rejected
      signIn.password = '';
      errors = await validate(signIn);
      expect(errors.some((e) => e.property === 'password')).toBe(true);

      // FirstPasswordDto enforces strong password policy on newPassword
      const firstPass = new FirstPasswordDto();
      firstPass.email = 'user@example.com';
      firstPass.password = 'simple';
      firstPass.newPassword = 'StrongP@ssword1';
      errors = await validate(firstPass);
      expect(errors).toHaveLength(0);

      firstPass.newPassword = 'weakpassword';
      errors = await validate(firstPass);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);

      // PasswordResetCompleteDto enforces strong password policy on newPassword
      const resetDto = new PasswordResetCompleteDto();
      resetDto.token = 'a'.repeat(30);
      resetDto.newPassword = 'StrongP@ssword1';
      errors = await validate(resetDto);
      expect(errors).toHaveLength(0);

      resetDto.newPassword = 'simple';
      errors = await validate(resetDto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });

    it('validates RejectPermitDto, DeferPermitDto, and ApprovalCommentDto allowing procedure links and numbers', async () => {
      const reject = new RejectPermitDto();
      reject.comment = 'Work scope is insufficient, see https://internal.wiki/rules';
      expect(await validate(reject)).toHaveLength(0);

      const defer = new DeferPermitDto();
      defer.comment = 'Please clarify reading: 101.3 kPa';
      expect(await validate(defer)).toHaveLength(0);

      const commentDto = new ApprovalCommentDto();
      commentDto.comment = 'Approved according to www.osha.gov/guidance';
      expect(await validate(commentDto)).toHaveLength(0);
    });

    it('validates platform defaults codes remain on letters/digits rule, while place codes allow shared helper', async () => {
      // Platform default codes enforce /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,63}$/
      const ppeItem = new DefaultPpeItemDto();
      ppeItem.code = 'PPE-GLOVES-01';
      ppeItem.name = 'Safety Gloves';
      ppeItem.categoryId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      expect(await validate(ppeItem)).toHaveLength(0);

      // Space in platform default code is rejected
      ppeItem.code = 'PPE GLOVES';
      expect((await validate(ppeItem)).some((e) => e.property === 'code')).toBe(true);

      const defaultPermit = new DefaultPermitTypeDto();
      defaultPermit.code = 'HOT_WORK';
      defaultPermit.name = 'Hot Work Permit';
      defaultPermit.color = '#EF4444';
      expect(await validate(defaultPermit)).toHaveLength(0);

      const defaultHazard = new DefaultHazardDto();
      defaultHazard.code = 'HAZ-FIRE-01';
      defaultHazard.name = 'Fire Risk';
      defaultHazard.category = 'Thermal';
      expect(await validate(defaultHazard)).toHaveLength(0);

      // Place codes (Site, Asset) allow shared CODE_REGEX
      const site = new CreateSiteDto();
      site.code = 'SITE-BLD-01';
      site.name = 'Building 1';
      expect(await validate(site)).toHaveLength(0);

      site.code = '-INVALID';
      expect((await validate(site)).some((e) => e.property === 'code')).toBe(true);

      const asset = new CreateAssetDto();
      asset.tag = 'TAG-100';
      asset.name = 'Pump 1';
      asset.workLocationId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      expect(await validate(asset)).toHaveLength(0);

      asset.tag = '.INVALID';
      expect((await validate(asset)).some((e) => e.property === 'tag')).toBe(true);
    });
  });
});
