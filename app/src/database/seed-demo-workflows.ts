import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from './database.module';
import {
  approvalHistory,
  conflictParticipants,
  employees,
  incidentHodDecisions,
  incidents,
  isolationExecution,
  isolationPoints,
  lototoAssignments,
  lototoPlans,
  notificationRecipients,
  notifications,
  permitApprovals,
  permitClosures,
  permitDrafts,
  permitEvidence,
  permitExecutors,
  permitHazards,
  permitExecution,
  permitProgress,
  permitPpe,
  permitVerifications,
  permits,
  permitArchive,
  simopsConflicts,
  workflowAssignments,
} from './schema';
import { DEMO_IDS, DEMO_TENANT_ID, DEMO_USER_IDS, SEED_ACTOR_ID } from './seed-ids';

const TS = {
  past: new Date('2026-07-01T08:00:00Z'),
  recent: new Date('2026-08-10T09:00:00Z'),
  now: new Date('2026-08-15T10:00:00Z'),
  future: new Date('2026-08-25T16:00:00Z'),
};

const CLOSURE_CHECKLIST = {
  workCompleted: true,
  evidenceReviewed: true,
  areaSecured: true,
  hazardsRemoved: true,
};

type PermitSeed = {
  id: string;
  reference: string;
  status: string;
  title: string;
  permitTypeId: string;
  locationId?: string;
  submitted?: boolean;
};

const PERMIT_SCENARIOS: PermitSeed[] = [
  {
    id: DEMO_IDS.permitDraft,
    reference: 'PTW-DEMO-001',
    status: 'draft',
    title: 'Draft — tank inspection (incomplete)',
    permitTypeId: DEMO_IDS.permitTypeColdWork,
  },
  {
    id: DEMO_IDS.permitPendingHod,
    reference: 'PTW-DEMO-002',
    status: 'pending_approval',
    title: 'Pending HOD initial review — welding repair',
    permitTypeId: DEMO_IDS.permitTypeHotWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitPendingSafety,
    reference: 'PTW-DEMO-003',
    status: 'pending_approval',
    title: 'Pending HOD review — confined space entry',
    permitTypeId: DEMO_IDS.permitTypeConfinedSpace,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitDeferred,
    reference: 'PTW-DEMO-004',
    status: 'deferred',
    title: 'Deferred — missing hazard assessment',
    permitTypeId: DEMO_IDS.permitTypeHotWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitRejected,
    reference: 'PTW-DEMO-005',
    status: 'rejected',
    title: 'Rejected — inadequate controls',
    permitTypeId: DEMO_IDS.permitTypeElectrical,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitApproved,
    reference: 'PTW-DEMO-006',
    status: 'approved',
    title: 'Approved — compressor maintenance',
    permitTypeId: DEMO_IDS.permitTypeColdWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitActive,
    reference: 'PTW-DEMO-007',
    status: 'active',
    title: 'Active — pump seal replacement',
    permitTypeId: DEMO_IDS.permitTypeColdWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitSuspended,
    reference: 'PTW-DEMO-008',
    status: 'suspended',
    title: 'Suspended — weather hold',
    permitTypeId: DEMO_IDS.permitTypeWorkingAtHeight,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitPendingClosure,
    reference: 'PTW-DEMO-009',
    status: 'pending_closure',
    title: 'Pending closure — valve replacement complete',
    permitTypeId: DEMO_IDS.permitTypeGeneralWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitClosed,
    reference: 'PTW-DEMO-010',
    status: 'closed',
    title: 'Closed — heat exchanger cleaning',
    permitTypeId: DEMO_IDS.permitTypeHotWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitCancelled,
    reference: 'PTW-DEMO-011',
    status: 'cancelled',
    title: 'Cancelled — work no longer required',
    permitTypeId: DEMO_IDS.permitTypeGeneralWork,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitExpired,
    reference: 'PTW-DEMO-012',
    status: 'expired',
    title: 'Expired — permit validity lapsed',
    permitTypeId: DEMO_IDS.permitTypeExcavation,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitSimopsA,
    reference: 'PTW-DEMO-013',
    status: 'active',
    title: 'SIMOPS A — shared tank farm work',
    permitTypeId: DEMO_IDS.permitTypeHotWork,
    locationId: DEMO_IDS.locationB,
    submitted: true,
  },
  {
    id: DEMO_IDS.permitSimopsB,
    reference: 'PTW-DEMO-014',
    status: 'approved',
    title: 'SIMOPS B — overlapping excavation',
    permitTypeId: DEMO_IDS.permitTypeExcavation,
    locationId: DEMO_IDS.locationB,
    submitted: true,
  },
];

export async function seedDemoWorkflows(db: Database): Promise<void> {
  await db.execute(sql`SET session_replication_role = 'replica'`);
  try {
    await clearDemoWorkflowData(db);
    await seedDemoWorkflowRecords(db);
  } finally {
    await db.execute(sql`SET session_replication_role = 'origin'`);
  }
}

async function clearDemoWorkflowData(db: Database): Promise<void> {
  console.log('Clearing previous demo workflow data...');

  await db
    .delete(notificationRecipients)
    .where(
      inArray(
        notificationRecipients.notificationId,
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            sql`${notifications.tenantId} = ${DEMO_TENANT_ID} AND ${notifications.dedupeKey} LIKE 'demo-%'`,
          ),
      ),
    );

  await db
    .delete(notifications)
    .where(
      sql`${notifications.tenantId} = ${DEMO_TENANT_ID} AND ${notifications.dedupeKey} LIKE 'demo-%'`,
    );

  await db.delete(conflictParticipants).where(eq(conflictParticipants.conflictId, DEMO_IDS.simopsConflict));
  await db.delete(simopsConflicts).where(eq(simopsConflicts.id, DEMO_IDS.simopsConflict));

  const demoIncidentIds = [
    DEMO_IDS.incidentOpen,
    DEMO_IDS.incidentNearMissHod,
    DEMO_IDS.incidentClosed,
  ];
  await db
    .delete(incidentHodDecisions)
    .where(inArray(incidentHodDecisions.incidentId, demoIncidentIds));
  await db.delete(incidents).where(inArray(incidents.id, demoIncidentIds));

  await db
    .delete(permits)
    .where(
      sql`${permits.tenantId} = ${DEMO_TENANT_ID} AND ${permits.reference} LIKE 'PTW-DEMO-%'`,
    );
}

async function seedDemoWorkflowRecords(db: Database): Promise<void> {
  console.log('Seeding demo workforce personas...');
  await db
    .insert(employees)
    .values([
      {
        id: DEMO_USER_IDS.hod,
        tenantId: DEMO_TENANT_ID,
        name: 'Head of Department',
        email: 'hod@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_USER_IDS.issuer,
        tenantId: DEMO_TENANT_ID,
        name: 'Job Issuer',
        email: 'issuer@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_USER_IDS.operator,
        tenantId: DEMO_TENANT_ID,
        name: 'Field Operator',
        email: 'operator@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_USER_IDS.safety,
        tenantId: DEMO_TENANT_ID,
        name: 'Safety Officer',
        email: 'safety@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding demo permits across lifecycle states...');
  await db
    .insert(permits)
    .values(
      PERMIT_SCENARIOS.map((scenario) => ({
        id: scenario.id,
        tenantId: DEMO_TENANT_ID,
        reference: scenario.reference,
        status: scenario.status,
        permitTypeId: scenario.permitTypeId,
        title: scenario.title,
        workScope: `Demo scenario: ${scenario.title}`,
        plantId: DEMO_IDS.plant,
        departmentId: DEMO_IDS.department,
        locationId: scenario.locationId ?? DEMO_IDS.location,
        workstationId: DEMO_IDS.workstation,
        machineryId: DEMO_IDS.machineryCompressor,
        plannedStartAt: TS.recent,
        plannedEndAt: TS.future,
        submittedAt: scenario.submitted ? TS.recent : null,
        submittedBy: scenario.submitted ? DEMO_USER_IDS.issuer : null,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(permitDrafts)
    .values({
      permitId: DEMO_IDS.permitDraft,
      currentStep: 2,
      formSnapshot: { step: 'hazards', incomplete: true },
      createdBy: DEMO_USER_IDS.issuer,
      updatedBy: DEMO_USER_IDS.issuer,
    })
    .onConflictDoNothing();

  const executorPermits = [
    DEMO_IDS.permitApproved,
    DEMO_IDS.permitActive,
    DEMO_IDS.permitSuspended,
    DEMO_IDS.permitPendingClosure,
    DEMO_IDS.permitSimopsA,
  ];

  await db
    .insert(permitExecutors)
    .values(
      executorPermits.map((permitId) => ({
        permitId,
        workforceUserId: DEMO_USER_IDS.operator,
        isPrimary: true,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(permitHazards)
    .values([
      {
        permitId: DEMO_IDS.permitPendingHod,
        hazardCategoryId: DEMO_IDS.hazardFire,
        description: 'Ignition source near hydrocarbon line',
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      },
      {
        permitId: DEMO_IDS.permitPendingSafety,
        hazardCategoryId: DEMO_IDS.hazardElectrical,
        description: 'Energised panel in adjacent room',
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(permitPpe)
    .values([
      {
        permitId: DEMO_IDS.permitActive,
        ppeCatalogueId: DEMO_IDS.ppeHelmet,
        quantity: 2,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      },
      {
        permitId: DEMO_IDS.permitActive,
        ppeCatalogueId: DEMO_IDS.ppeGloves,
        quantity: 4,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding approval workflow states...');
  await seedApprovalStates(db);

  console.log('Seeding execution records...');
  await db
    .insert(permitExecution)
    .values([
      {
        id: DEMO_IDS.executionActive,
        permitId: DEMO_IDS.permitActive,
        activatedAt: TS.recent,
        activatedBy: DEMO_USER_IDS.operator,
        actualStartAt: TS.recent,
        createdBy: DEMO_USER_IDS.operator,
        updatedBy: DEMO_USER_IDS.operator,
      },
      {
        id: DEMO_IDS.executionSuspended,
        permitId: DEMO_IDS.permitSuspended,
        activatedAt: TS.past,
        activatedBy: DEMO_USER_IDS.operator,
        actualStartAt: TS.past,
        suspendedAt: TS.now,
        suspendedBy: DEMO_USER_IDS.hod,
        suspensionReason: 'High wind — work at height suspended',
        createdBy: DEMO_USER_IDS.operator,
        updatedBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(permitProgress)
    .values({
      permitId: DEMO_IDS.permitActive,
      executionId: DEMO_IDS.executionActive,
      summary: 'Isolation verified; seal removed and replacement in progress',
      recordedBy: DEMO_USER_IDS.operator,
      recordedAt: TS.now,
      createdBy: DEMO_USER_IDS.operator,
    })
    .onConflictDoNothing();

  await db
    .insert(permitEvidence)
    .values({
      permitId: DEMO_IDS.permitActive,
      executionId: DEMO_IDS.executionActive,
      fileName: 'seal-replacement-photo.jpg',
      contentType: 'image/jpeg',
      fileSize: 245_760,
      storageBucket: 'ptw-documents',
      storageKey: 'demo/evidence/seal-replacement-photo.jpg',
      uploadedBy: DEMO_USER_IDS.operator,
      comment: 'Before/after seal condition',
      createdBy: DEMO_USER_IDS.operator,
      updatedBy: DEMO_USER_IDS.operator,
    })
    .onConflictDoNothing();

  console.log('Seeding closure records...');
  await db
    .insert(permitVerifications)
    .values({
      permitId: DEMO_IDS.permitClosed,
      verifiedBy: DEMO_USER_IDS.hod,
      verifiedAt: TS.past,
      comment: 'Area secured and housekeeping complete',
      checklist: CLOSURE_CHECKLIST,
      createdBy: DEMO_USER_IDS.hod,
    })
    .onConflictDoNothing();

  await db
    .insert(permitClosures)
    .values({
      permitId: DEMO_IDS.permitClosed,
      closedBy: DEMO_USER_IDS.hod,
      closedAt: TS.past,
      actualEndAt: TS.past,
      comment: 'Work completed satisfactorily',
      createdBy: DEMO_USER_IDS.hod,
    })
    .onConflictDoNothing();

  await db
    .insert(permitArchive)
    .values({
      tenantId: DEMO_TENANT_ID,
      permitId: DEMO_IDS.permitClosed,
      title: 'Closed — heat exchanger cleaning',
      reference: 'PTW-DEMO-010',
      closedAt: TS.past,
      closedBy: DEMO_USER_IDS.hod,
    })
    .onConflictDoNothing();

  console.log('Seeding LOTOTO plans...');
  await seedLototo(db);

  console.log('Seeding incidents...');
  await seedIncidents(db);

  console.log('Seeding SIMOPS conflict...');
  await seedSimops(db);

  console.log('Seeding notifications...');
  await seedNotifications(db);
}

async function seedApprovalStates(db: Database): Promise<void> {
  await db
    .insert(workflowAssignments)
    .values([
      {
        permitId: DEMO_IDS.permitPendingHod,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        assigneeId: DEMO_USER_IDS.issuer,
        assignmentSlot: 'default',
        status: 'active',
        assignedAt: TS.recent,
        slaDeadlineAt: TS.future,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.issuer,
      },
      {
        permitId: DEMO_IDS.permitPendingSafety,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        assigneeId: DEMO_USER_IDS.issuer,
        assignmentSlot: 'default',
        status: 'active',
        assignedAt: TS.recent,
        slaDeadlineAt: TS.future,
        createdBy: DEMO_USER_IDS.issuer,
        updatedBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(permitApprovals)
    .values([
      {
        permitId: DEMO_IDS.permitDeferred,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        decision: 'defer',
        comment: 'Upload updated hazard assessment before resubmitting',
        reasonCode: 'documentation_missing',
        decidedBy: DEMO_USER_IDS.hod,
        decidedAt: TS.recent,
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
      {
        permitId: DEMO_IDS.permitRejected,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        decision: 'reject',
        comment: 'Isolation plan does not cover all energy sources',
        reasonCode: 'insufficient_controls',
        decidedBy: DEMO_USER_IDS.hod,
        decidedAt: TS.recent,
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(approvalHistory)
    .values([
      {
        permitId: DEMO_IDS.permitPendingHod,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        action: 'submitted',
        fromStatus: 'draft',
        toStatus: 'pending_approval',
        actorId: DEMO_USER_IDS.issuer,
        comment: 'Submitted after executor completed on-site details',
        createdBy: DEMO_USER_IDS.issuer,
      },
      {
        permitId: DEMO_IDS.permitDeferred,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        action: 'deferred',
        fromStatus: 'pending_approval',
        toStatus: 'deferred',
        actorId: DEMO_USER_IDS.hod,
        comment: 'Missing documentation',
        createdBy: DEMO_USER_IDS.hod,
      },
      {
        permitId: DEMO_IDS.permitRejected,
        workflowStepId: DEMO_IDS.workflowHodInitial,
        action: 'rejected',
        fromStatus: 'pending_approval',
        toStatus: 'rejected',
        actorId: DEMO_USER_IDS.hod,
        createdBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();
}

async function seedLototo(db: Database): Promise<void> {
  await db
    .insert(lototoPlans)
    .values([
      {
        id: DEMO_IDS.lototoPlanDraft,
        tenantId: DEMO_TENANT_ID,
        permitId: DEMO_IDS.permitApproved,
        workstationId: DEMO_IDS.workstation,
        machineryId: DEMO_IDS.machineryCompressor,
        reference: 'LOTOTO-DEMO-001',
        title: 'Compressor electrical isolation (draft plan)',
        status: 'draft',
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
      {
        id: DEMO_IDS.lototoPlanReady,
        tenantId: DEMO_TENANT_ID,
        permitId: DEMO_IDS.permitApproved,
        workstationId: DEMO_IDS.workstation,
        machineryId: DEMO_IDS.machineryPump,
        reference: 'LOTOTO-DEMO-002',
        title: 'Pump mechanical isolation (ready)',
        status: 'ready',
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
      {
        id: DEMO_IDS.lototoPlanInExecution,
        tenantId: DEMO_TENANT_ID,
        permitId: DEMO_IDS.permitActive,
        workstationId: DEMO_IDS.workstation,
        machineryId: DEMO_IDS.machineryPump,
        reference: 'LOTOTO-DEMO-003',
        title: 'Active pump isolation — operator applying locks',
        status: 'in_execution',
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.operator,
      },
    ])
    .onConflictDoUpdate({
      target: [lototoPlans.tenantId, lototoPlans.reference],
      set: {
        status: sql`excluded.status`,
        title: sql`excluded.title`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(isolationPoints)
    .values([
      {
        id: DEMO_IDS.isolationPoint1,
        planId: DEMO_IDS.lototoPlanInExecution,
        machineryId: DEMO_IDS.machineryPump,
        isolationNumber: 'ISO-001',
        description: 'Main breaker isolation',
        verificationRequired: true,
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
      {
        id: DEMO_IDS.isolationPoint2,
        planId: DEMO_IDS.lototoPlanInExecution,
        machineryId: DEMO_IDS.machineryPump,
        isolationNumber: 'ISO-002',
        description: 'Valve lockout',
        verificationRequired: true,
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(lototoAssignments)
    .values([
      {
        planId: DEMO_IDS.lototoPlanInExecution,
        workforceUserId: DEMO_USER_IDS.operator,
        role: 'operator',
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
      {
        planId: DEMO_IDS.lototoPlanInExecution,
        workforceUserId: DEMO_USER_IDS.safety,
        role: 'safety-officer',
        createdBy: DEMO_USER_IDS.hod,
        updatedBy: DEMO_USER_IDS.hod,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(isolationExecution)
    .values({
      id: DEMO_IDS.isolationExecution,
      tenantId: DEMO_TENANT_ID,
      planId: DEMO_IDS.lototoPlanInExecution,
      status: 'in_progress',
      startedBy: DEMO_USER_IDS.operator,
      startedAt: TS.now,
      createdBy: DEMO_USER_IDS.operator,
      updatedBy: DEMO_USER_IDS.operator,
    })
    .onConflictDoNothing();
}

async function seedIncidents(db: Database): Promise<void> {
  await db
    .insert(incidents)
    .values([
      {
        id: DEMO_IDS.incidentOpen,
        tenantId: DEMO_TENANT_ID,
        reference: 'INC-DEMO-001',
        incidentType: 'unsafe_condition',
        severityPath: 'near_miss',
        status: 'open',
        title: 'Open — oil leak near work area',
        description: 'Minor hydraulic leak observed during pump work',
        locationDescription: 'Compressor bay',
        occurredAt: TS.now,
        priority: 'medium',
        reportedBy: DEMO_USER_IDS.operator,
        submittedBy: DEMO_USER_IDS.operator,
        submittedAt: TS.now,
        plantId: DEMO_IDS.plant,
        locationId: DEMO_IDS.location,
        createdBy: DEMO_USER_IDS.operator,
        updatedBy: DEMO_USER_IDS.operator,
      },
      {
        id: DEMO_IDS.incidentNearMissHod,
        tenantId: DEMO_TENANT_ID,
        reference: 'INC-DEMO-002',
        incidentType: 'near_miss',
        severityPath: 'near_miss',
        status: 'pending_hod_decision',
        title: 'Near-miss — dropped tool from scaffold',
        description: 'Tool fell from height; no injury but area not barricaded',
        locationDescription: 'Tank farm scaffold',
        occurredAt: TS.recent,
        priority: 'high',
        reportedBy: DEMO_USER_IDS.operator,
        submittedBy: DEMO_USER_IDS.operator,
        submittedAt: TS.recent,
        plantId: DEMO_IDS.plant,
        locationId: DEMO_IDS.location,
        createdBy: DEMO_USER_IDS.operator,
        updatedBy: DEMO_USER_IDS.operator,
      },
      {
        id: DEMO_IDS.incidentClosed,
        tenantId: DEMO_TENANT_ID,
        reference: 'INC-DEMO-003',
        incidentType: 'incident',
        severityPath: 'accident',
        status: 'closed',
        title: 'Closed — minor first aid case',
        description: 'Resolved slip incident; corrective actions completed',
        locationDescription: 'Operations corridor',
        occurredAt: TS.past,
        priority: 'low',
        reportedBy: DEMO_USER_IDS.operator,
        submittedBy: DEMO_USER_IDS.operator,
        submittedAt: TS.past,
        plantId: DEMO_IDS.plant,
        locationId: DEMO_IDS.location,
        createdBy: DEMO_USER_IDS.operator,
        updatedBy: DEMO_USER_IDS.safety,
      },
    ])
    .onConflictDoUpdate({
      target: [incidents.tenantId, incidents.reference],
      set: {
        status: sql`excluded.status`,
        title: sql`excluded.title`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(incidentHodDecisions)
    .values({
      tenantId: DEMO_TENANT_ID,
      incidentId: DEMO_IDS.incidentClosed,
      decision: 'stop',
      decidedBy: DEMO_USER_IDS.hod,
      comment: 'Work stopped until walkway cleaned',
      createdBy: DEMO_USER_IDS.hod,
    })
    .onConflictDoNothing();
}

async function seedSimops(db: Database): Promise<void> {
  await db
    .insert(simopsConflicts)
    .values({
      id: DEMO_IDS.simopsConflict,
      tenantId: DEMO_TENANT_ID,
      status: 'open',
      severity: 'high',
      conflictType: 'location',
      summary: 'Overlapping hot work and excavation at tank farm',
      details: {
        permits: [DEMO_IDS.permitSimopsA, DEMO_IDS.permitSimopsB],
        edgeCase: 'unresolved_location_overlap',
      },
      detectedAt: TS.now,
      fingerprint: 'demo-simops-tank-farm-overlap',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoUpdate({
      target: [simopsConflicts.tenantId, simopsConflicts.fingerprint],
      set: {
        status: sql`excluded.status`,
        summary: sql`excluded.summary`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(conflictParticipants)
    .values([
      {
        tenantId: DEMO_TENANT_ID,
        conflictId: DEMO_IDS.simopsConflict,
        permitId: DEMO_IDS.permitSimopsA,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        tenantId: DEMO_TENANT_ID,
        conflictId: DEMO_IDS.simopsConflict,
        permitId: DEMO_IDS.permitSimopsB,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();
}

async function seedNotifications(db: Database): Promise<void> {
  await db
    .insert(notifications)
    .values([
      {
        id: DEMO_IDS.notificationPendingApproval,
        tenantId: DEMO_TENANT_ID,
        eventType: 'permit_submitted',
        category: 'workflow',
        priority: 'high',
        title: 'Permit awaiting your approval',
        body: 'PTW-DEMO-002 welding repair is pending HOD approval.',
        entityType: 'permit',
        entityId: DEMO_IDS.permitPendingHod,
        dedupeKey: 'demo-notif-pending-hod',
        sourceModule: 'approval',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_IDS.notificationReminder,
        tenantId: DEMO_TENANT_ID,
        eventType: 'task_reminder',
        category: 'reminder',
        priority: 'medium',
        title: 'Daily progress update due',
        body: 'PTW-DEMO-007 requires a progress entry before end of shift.',
        entityType: 'permit',
        entityId: DEMO_IDS.permitActive,
        dedupeKey: 'demo-notif-progress-reminder',
        sourceModule: 'execution',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_IDS.notificationEscalation,
        tenantId: DEMO_TENANT_ID,
        eventType: 'escalation',
        category: 'escalation',
        priority: 'critical',
        title: 'SIMOPS conflict unresolved',
        body: 'High severity overlap detected at tank farm — review required.',
        entityType: 'simops_conflict',
        entityId: DEMO_IDS.simopsConflict,
        dedupeKey: 'demo-notif-simops-escalation',
        sourceModule: 'simops',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoUpdate({
      target: [notifications.tenantId, notifications.dedupeKey],
      set: {
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(notificationRecipients)
    .values([
      {
        tenantId: DEMO_TENANT_ID,
        notificationId: DEMO_IDS.notificationPendingApproval,
        userId: DEMO_USER_IDS.hod,
        channel: 'in_app',
        deliveryStatus: 'delivered',
        deliveredAt: TS.now,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        tenantId: DEMO_TENANT_ID,
        notificationId: DEMO_IDS.notificationReminder,
        userId: DEMO_USER_IDS.operator,
        channel: 'in_app',
        deliveryStatus: 'delivered',
        deliveredAt: TS.now,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        tenantId: DEMO_TENANT_ID,
        notificationId: DEMO_IDS.notificationEscalation,
        userId: DEMO_USER_IDS.hod,
        channel: 'in_app',
        deliveryStatus: 'delivered',
        deliveredAt: TS.now,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        tenantId: DEMO_TENANT_ID,
        notificationId: DEMO_IDS.notificationEscalation,
        userId: DEMO_USER_IDS.safety,
        channel: 'in_app',
        deliveryStatus: 'delivered',
        deliveredAt: TS.now,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();
}
