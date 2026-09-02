import { afterEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";

const { careRemindersRouter } = await import("../routers/care-reminders");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const REMINDER_ID = "00000000-0000-0000-0000-000000000003";

const practice = { id: PRACTICE_ID, timezone: "America/Costa_Rica" };
const patient = { id: PATIENT_ID };

function queryBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);

  builder.from = chain;
  builder.innerJoin = chain;
  builder.where = chain;
  builder.orderBy = chain;
  builder.limit = chain;
  builder.for = chain;
  builder.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

function sqlIncludesValue(
  value: unknown,
  needle: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (Object.is(value, needle)) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => sqlIncludesValue(item, needle, seen));
  }

  return Object.values(value as Record<string, unknown>).some((item) =>
    sqlIncludesValue(item, needle, seen),
  );
}

function createDb(
  selectResults: unknown[][],
  returningResults: unknown[][] = [],
  updateResultFor?: (condition: unknown) => unknown[],
) {
  const updateReturning = vi.fn(async () => returningResults.shift() ?? []);
  const updateWhere = vi.fn((condition: unknown) => ({
    returning: updateResultFor
      ? vi.fn(async () => updateResultFor(condition))
      : updateReturning,
  }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const insertReturning = vi.fn(async () => returningResults.shift() ?? []);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const select = vi.fn(() => queryBuilder(selectResults.shift() ?? []));
  const db: Record<string, unknown> = {
    select,
    insert,
    update,
    execute: vi.fn(async () => undefined),
  };
  db.transaction = async (fn: (tx: Record<string, unknown>) => unknown) =>
    fn(db);

  return { db, insertValues, update, updateSet };
}

function caller(db: Record<string, unknown>) {
  return careRemindersRouter.createCaller({
    db,
    session: {
      user: {
        id: USER_ID,
        email: "vet@example.com",
        name: "Veterinarian",
        role: "veterinarian",
        practiceId: PRACTICE_ID,
      },
    },
  } as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("care reminder completion concurrency", () => {
  it("preserves the database microsecond version through list, SuperJSON, and completion", async () => {
    const databaseVersion = "2026-08-28T20:34:39.762118Z";
    const createdAt = new Date(databaseVersion);
    const created = {
      id: REMINDER_ID,
      patientId: PATIENT_ID,
      status: "open",
      updatedAt: createdAt,
    };
    const current = {
      id: REMINDER_ID,
      status: "open",
      updatedAtVersion: databaseVersion,
    };
    const completed = {
      ...current,
      status: "completed",
      completedAt: new Date("2026-08-28T12:01:00.000Z"),
    };
    const { db, update } = createDb(
      [
        [practice],
        [patient],
        [practice],
        [{
          id: REMINDER_ID,
          patientId: PATIENT_ID,
          patientName: "Ragnar Lothbrok",
          patientStatus: "active",
          clientId: "00000000-0000-0000-0000-000000000004",
          clientName: "Lagertha Lothbrok",
          title: "Follow-up",
          notes: null,
          dueDate: "2026-08-31",
          status: "open",
          imported: false,
          completedAt: null,
          createdAt,
          updatedAt: createdAt,
          updatedAtVersion: databaseVersion,
        }],
        [{ open: 1, overdue: 0, upcoming: 1, completed: 0 }],
        [practice],
        [current],
      ],
      [[created]],
      (condition) =>
        sqlIncludesValue(condition, databaseVersion) ? [completed] : [],
    );

    const reminder = await caller(db).create({
      patientId: PATIENT_ID,
      title: "Follow-up",
      dueDate: "2026-08-31",
    });
    const listed = await caller(db).list({ status: "open", due: "all", limit: 1000 });
    const clientList = superjson.deserialize<typeof listed>(
      superjson.serialize(listed),
    );
    const result = await caller(db).setCompleted({
      id: reminder.id,
      completed: true,
      expectedUpdatedAt: clientList.items[0]!.updatedAtVersion,
    });

    expect(reminder.updatedAt.toISOString()).toBe("2026-08-28T20:34:39.762Z");
    expect(clientList.items[0]!.updatedAt.toISOString()).toBe(
      "2026-08-28T20:34:39.762Z",
    );
    expect(clientList.items[0]!.updatedAtVersion).toBe(databaseVersion);
    expect(reminder).toEqual(created);
    expect(result).toEqual(completed);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("preserves a real stale-version conflict", async () => {
    const staleVersion = "2026-08-28T12:00:00.000001Z";
    const currentVersion = "2026-08-28T12:00:00.000999Z";
    const { db, update } = createDb([[practice], [{
      id: REMINDER_ID,
      status: "open",
      updatedAtVersion: currentVersion,
    }]]);

    await expect(
      caller(db).setCompleted({
        id: REMINDER_ID,
        completed: true,
        expectedUpdatedAt: staleVersion,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This reminder changed. Refresh before updating it.",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
