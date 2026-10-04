import { randomUUID } from 'crypto';
import { DEFAULT_ROLES, PERMISSIONS } from '@ptw/shared';
import { runInContext } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import {
  assignRole,
  insertDefaultRoles,
  insertDepartment,
  insertLegalEntity,
  insertOrganisation,
  insertPerson,
  insertPlant,
  makeAdmin,
} from './helpers/fixtures';
import { services } from './helpers/services';

describe('Permissions (FR-ROL-001, FR-ROL-007)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { permissions } = services();
  let tenant: string;
  let entity: string;
  let plant: string;
  let otherPlant: string;
  let department: string;
  let otherDepartment: string;
  let roleIds: Record<string, string>;
  let approver: string;
  let departmentApprover: string;
  let admin: string;
  let viewer: string; // the person whose context the checks run in

  const holds = (personId: string, permission: (typeof PERMISSIONS)[number], plantId: string, departmentId: string | null) =>
    runInContext(api.db, userCtx(tenant, viewer, [entity]), (tx) => permissions.holds(tx, personId, permission, plantId, departmentId));

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    plant = await insertPlant(owner, tenant, entity);
    otherPlant = await insertPlant(owner, tenant, entity);
    department = await insertDepartment(owner, tenant, entity);
    otherDepartment = await insertDepartment(owner, tenant, entity);
    roleIds = await insertDefaultRoles(owner, tenant, entity);
    approver = (await insertPerson(owner, tenant, entity)).personId;
    departmentApprover = (await insertPerson(owner, tenant, entity)).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    viewer = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: approver, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_PERMIT_APPROVER });
    await assignRole(owner, {
      tenantId: tenant, personId: departmentApprover, plantId: plant, legalEntityId: entity,
      roleId: roleIds.PTW_PERMIT_APPROVER, departmentId: department,
    });
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'TENANT_ORG_ADMIN' });
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('lists 37 unique permissions, and the five default roles use only them', () => {
    expect(new Set(PERMISSIONS).size).toBe(37);
    expect(DEFAULT_ROLES).toHaveLength(5);
    for (const role of DEFAULT_ROLES) for (const p of role.permissions) expect(PERMISSIONS).toContain(p);
  });

  it('stores a role holding every permission, and refuses an unknown one', async () => {
    const insert = (perms: string[]) =>
      owner.query(`insert into roles (tenant_id, legal_entity_id, name, permissions) values ($1, $2, $3, $4)`, [tenant, entity, `R ${randomUUID()}`, perms]);
    expect(await pgErrorCode(insert([...PERMISSIONS]))).toBeUndefined();
    expect(await pgErrorCode(insert(['fly_plane']))).toBe('23514');
  });

  it('grants a role permission only at the assigned plant', async () => {
    expect(await holds(approver, 'approve', plant, null)).toBe(true);
    expect(await holds(approver, 'approve', plant, department)).toBe(true);
    expect(await holds(approver, 'issue_permit', plant, null)).toBe(false);
    expect(await holds(approver, 'approve', otherPlant, null)).toBe(false);
  });

  it('limits a department-scoped assignment to its department', async () => {
    expect(await holds(departmentApprover, 'approve', plant, department)).toBe(true);
    expect(await holds(departmentApprover, 'approve', plant, otherDepartment)).toBe(false);
    expect(await holds(departmentApprover, 'approve', plant, null)).toBe(false);
  });

  it('gives admin roles no permit permission anywhere (FR-ROL-007)', async () => {
    for (const p of PERMISSIONS) expect(await holds(admin, p, plant, null)).toBe(false);
    const isAdmin = await runInContext(api.db, userCtx(tenant, viewer, [entity]), (tx) => permissions.isLegalEntityAdmin(tx, admin, entity));
    expect(isAdmin).toBe(true);
  });

  it('grants nothing through a retired role or to a person who has left', async () => {
    const leaver = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: leaver, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_SAFETY_OFFICER });
    expect(await holds(leaver, 'safety_check', plant, null)).toBe(true);
    await owner.query(`update people set status = 'left', left_on = current_date where id = $1`, [leaver]);
    expect(await holds(leaver, 'safety_check', plant, null)).toBe(false);

    const retiring = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: retiring, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_PERMIT_EXECUTOR });
    await owner.query(`update roles set status = 'retired' where id = $1`, [roleIds.PTW_PERMIT_EXECUTOR]);
    expect(await holds(retiring, 'record_progress', plant, null)).toBe(false);
    await owner.query(`update roles set status = 'active' where id = $1`, [roleIds.PTW_PERMIT_EXECUTOR]);
  });

  it("refuses a role assignment whose role belongs to another legal entity than the plant's", async () => {
    const secondEntity = await insertLegalEntity(owner, tenant);
    const foreignRoles = await insertDefaultRoles(owner, tenant, secondEntity);
    const code = await pgErrorCode(
      assignRole(owner, { tenantId: tenant, personId: approver, plantId: plant, legalEntityId: entity, roleId: foreignRoles.PTW_PERMIT_APPROVER }),
    );
    expect(code).toBe('23503');
  });
});
