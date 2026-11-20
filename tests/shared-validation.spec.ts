import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  NAME_REGEX,
  PHONE_REGEX,
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
  validatePhone,
  validateText,
  validateEmail,
  validatePin,
  validatePassword,
  validateCode,
  validateUuid,
} from '../frontend/src/lib/validation';
import { CreatePermitDto } from '../app/src/modules/permit/dto/create-permit.dto';
import { UpdatePermitDto } from '../app/src/modules/permit/dto/update-permit.dto';
import { SubmitPermitDto } from '../app/src/modules/permit/dto/save-draft.dto';
import { FirstPasswordDto, PasswordResetCompleteDto } from '../app/src/modules/auth/dto/sign-in.dto';
import { RejectPermitDto } from '../app/src/modules/approval/dto/reject-permit.dto';
import { DeferPermitDto } from '../app/src/modules/approval/dto/defer-permit.dto';
import { ApprovalCommentDto } from '../app/src/modules/approval/dto/approval-comment.dto';
import { CreateSiteDto, CreateAssetDto } from '../app/src/modules/place/dto/place.dto';

describe('Shared Field Validation (Issue #341)', () => {
  describe('Client validateField helpers', () => {
    it('allows absent/empty values (format validation only enforces when value is present)', () => {
      expect(validateField('name', '')).toBeNull();
      expect(validateField('name', null)).toBeNull();
      expect(validateField('name', undefined)).toBeNull();
      expect(validateField('name', '   ')).toBeNull();
      expect(validateField('text', '')).toBeNull();
      expect(validateField('phone', '')).toBeNull();
      expect(validateField('email', '')).toBeNull();
      expect(validateField('pin', '')).toBeNull();
      expect(validateField('code', '')).toBeNull();
      expect(validateField('password', '')).toBeNull();
      expect(validateField('uuid', '')).toBeNull();
    });

    it('validates name category', () => {
      expect(validateName('John Doe')).toBeNull();
      expect(validateName("O'Connor & Sons - Line/1 (Main)")).toBeNull();
      expect(validateName('123456')).not.toBeNull();
      expect(validateName('!@#$%')).not.toBeNull();
    });

    it('validates phone category', () => {
      expect(validatePhone('+91 9876543210')).toBeNull();
      expect(validatePhone('+1 2025550123')).toBeNull();
      expect(validatePhone('9876543210')).not.toBeNull();
      expect(validatePhone('+91 123')).not.toBeNull();
    });

    it('validates text category and blocks links', () => {
      expect(validateText('Standard safety notes.')).toBeNull();
      expect(validateText('Detailed findings with 123 items.')).toBeNull();
      expect(validateText('Visit https://malicious.site')).not.toBeNull();
      expect(validateText('Check http://insecure.site')).not.toBeNull();
      expect(validateText('See www.site.com')).not.toBeNull();
      expect(validateText('123456')).not.toBeNull();
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

  describe('Regex symmetry with app common/validation', () => {
    it('matches name regex', () => {
      expect(NAME_REGEX.test('John Doe')).toBe(true);
      expect(NAME_REGEX.test('123456')).toBe(false);
    });

    it('matches phone regex', () => {
      expect(PHONE_REGEX.test('+91 9876543210')).toBe(true);
      expect(PHONE_REGEX.test('9876543210')).toBe(false);
    });

    it('matches text regex', () => {
      expect(TEXT_REGEX.test('Safe work procedure')).toBe(true);
      expect(TEXT_REGEX.test('visit https://example.com')).toBe(false);
      expect(TEXT_REGEX.test('12345')).toBe(false);
    });

    it('matches pin regex', () => {
      expect(PIN_REGEX.test('560001')).toBe(true);
      expect(PIN_REGEX.test('!BAD')).toBe(false);
    });

    it('matches code regex', () => {
      expect(CODE_REGEX.test('SITE-01')).toBe(true);
      expect(CODE_REGEX.test('-BAD')).toBe(false);
    });

    it('matches email regex', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('invalid')).toBe(false);
    });

    it('matches password regex', () => {
      expect(PASSWORD_REGEX.test('StrongP@ss1')).toBe(true);
      expect(PASSWORD_REGEX.test('weakpass')).toBe(false);
    });

    it('matches uuid regex', () => {
      expect(UUID_REGEX.test('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
      expect(UUID_REGEX.test('invalid-uuid')).toBe(false);
    });
  });

  describe('Backend DTO class-validator enforcement', () => {
    it('validates CreatePermitDto fields', async () => {
      const dto = new CreatePermitDto();
      dto.permitTypeId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      dto.title = 'Valid Work Title';
      dto.workScope = 'Valid work scope with description';
      dto.siteNotes = 'Valid notes';
      dto.emergencyPhone = '+91 9876543210';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Invalid title (numbers only)
      dto.title = '123456';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);

      // Invalid workScope (contains link)
      dto.title = 'Valid Work Title';
      dto.workScope = 'See details at https://leak.com';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'workScope')).toBe(true);

      // Invalid emergencyPhone
      dto.workScope = 'Valid work scope';
      dto.emergencyPhone = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emergencyPhone')).toBe(true);
    });

    it('validates UpdatePermitDto fields', async () => {
      const dto = new UpdatePermitDto();
      dto.title = 'Valid Title';
      dto.safetyApprovalComment = 'Approved with caution';
      dto.safetyApprovalSignedName = 'Officer Jane';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      dto.safetyApprovalComment = 'Check www.external.com';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'safetyApprovalComment')).toBe(true);

      dto.safetyApprovalComment = 'Valid comment';
      dto.safetyApprovalSignedName = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'safetyApprovalSignedName')).toBe(true);
    });

    it('validates SubmitPermitDto signedName', async () => {
      const dto = new SubmitPermitDto();
      dto.expectedRevision = 1;
      dto.signedName = 'Alice Smith';

      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      dto.signedName = '12345';
      errors = await validate(dto);
      expect(errors.some((e) => e.property === 'signedName')).toBe(true);
    });

    it('validates FirstPasswordDto and PasswordResetCompleteDto password policy', async () => {
      const firstPass = new FirstPasswordDto();
      firstPass.email = 'user@example.com';
      firstPass.password = 'tempPass123';
      firstPass.newPassword = 'StrongP@ssword1';

      let errors = await validate(firstPass);
      expect(errors).toHaveLength(0);

      firstPass.newPassword = 'weakpassword';
      errors = await validate(firstPass);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);

      const resetDto = new PasswordResetCompleteDto();
      resetDto.token = 'a'.repeat(30);
      resetDto.newPassword = 'StrongP@ssword1';

      errors = await validate(resetDto);
      expect(errors).toHaveLength(0);

      resetDto.newPassword = 'simple';
      errors = await validate(resetDto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });

    it('validates RejectPermitDto, DeferPermitDto, and ApprovalCommentDto comment', async () => {
      const reject = new RejectPermitDto();
      reject.comment = 'Work scope is insufficient';
      expect(await validate(reject)).toHaveLength(0);

      reject.comment = 'Go to https://phish.com';
      expect((await validate(reject)).some((e) => e.property === 'comment')).toBe(true);

      const defer = new DeferPermitDto();
      defer.comment = 'Please clarify details';
      expect(await validate(defer)).toHaveLength(0);

      defer.comment = 'See http://link.com';
      expect((await validate(defer)).some((e) => e.property === 'comment')).toBe(true);

      const commentDto = new ApprovalCommentDto();
      commentDto.comment = 'All checks completed';
      expect(await validate(commentDto)).toHaveLength(0);

      commentDto.comment = 'Visit www.test.com';
      expect((await validate(commentDto)).some((e) => e.property === 'comment')).toBe(true);
    });

    it('validates Site and Asset code/tag with shared CODE_REGEX', async () => {
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
