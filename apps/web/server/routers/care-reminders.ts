import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { careReminders, clients, patients, practices } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import {
  clinicalDateInput,
  clinicalTextInput,
} from "@/lib/records/clinical-inputs";
import { createRouter, protectedProcedure, requireRole } from "../trpc";

const manageProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk"),
);
const reminderTitleInput = clinicalTextInput("Reminder title", 255);
const reminderNotesInput = z
  .string()
  .trim()
  .max(4000, "Reminder notes must be at most 4,000 characters.")
  .optional()
  .transform((value) => value || undefined);
const expectedUpdatedAtInput = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
    "Reminder version must be an ISO UTC timestamp with microsecond precision.",
  );
const careReminderUpdatedAtVersion = sql<string>`to_char(
  ${careReminders.updatedAt} at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
)`;

async function activePractice(
  db: Pick<Database, "select">,
  practiceId: string,
) {
  const [practice] = await db
    .select({ id: practices.id, timezone: practices.timezone })
    .from(practices)
    .where(and(eq(practices.id, practiceId), isNull(practices.deletedAt)))
    .limit(1);
  if (!practice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
  }
  return practice;
}

export const careRemindersRouter = createRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "completed", "all"]).default("open"),
          due: z.enum(["all", "overdue", "upcoming"]).default("all"),
          patientId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(1000).default(500),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const practice = await activePractice(ctx.db, ctx.practiceId);
      const today = formatDateInputForTimeZone(
        new Date(),
        practice.timezone ?? null,
      );
      const status = input?.status ?? "open";
      const due = input?.due ?? "all";
      const conditions = [
        eq(careReminders.practiceId, ctx.practiceId),
        eq(patients.practiceId, ctx.practiceId),
        eq(clients.practiceId, ctx.practiceId),
        isNull(careReminders.deletedAt),
        isNull(patients.deletedAt),
        isNull(clients.deletedAt),
      ];
      if (status !== "all") conditions.push(eq(careReminders.status, status));
      if (due === "overdue") conditions.push(lte(careReminders.dueDate, today));
      if (due === "upcoming") conditions.push(gt(careReminders.dueDate, today));
      if (input?.patientId) {
        conditions.push(eq(careReminders.patientId, input.patientId));
      }

      const items = await ctx.db
        .select({
          id: careReminders.id,
          patientId: careReminders.patientId,
          patientName: patients.name,
          patientStatus: patients.status,
          clientId: clients.id,
          clientName: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
          title: careReminders.title,
          notes: careReminders.notes,
          dueDate: careReminders.dueDate,
          status: careReminders.status,
          imported: sql<boolean>`${careReminders.externalSource} is not null`,
          completedAt: careReminders.completedAt,
          createdAt: careReminders.createdAt,
          updatedAt: careReminders.updatedAt,
          updatedAtVersion: careReminderUpdatedAtVersion,
        })
        .from(careReminders)
        .innerJoin(patients, eq(careReminders.patientId, patients.id))
        .innerJoin(clients, eq(patients.clientId, clients.id))
        .where(and(...conditions))
        .orderBy(
          status === "completed"
            ? desc(careReminders.completedAt)
            : asc(careReminders.dueDate),
          asc(careReminders.id),
        )
        .limit(input?.limit ?? 500);

      const [counts] = await ctx.db
        .select({
          open: sql<number>`count(*) filter (where ${careReminders.status} = 'open')::int`,
          overdue: sql<number>`count(*) filter (where ${careReminders.status} = 'open' and ${careReminders.dueDate} <= ${today})::int`,
          upcoming: sql<number>`count(*) filter (where ${careReminders.status} = 'open' and ${careReminders.dueDate} > ${today})::int`,
          completed: sql<number>`count(*) filter (where ${careReminders.status} = 'completed')::int`,
        })
        .from(careReminders)
        .where(
          and(
            eq(careReminders.practiceId, ctx.practiceId),
            isNull(careReminders.deletedAt),
          ),
        );

      return {
        today,
        counts: counts ?? { open: 0, overdue: 0, upcoming: 0, completed: 0 },
        items,
      };
    }),

  create: manageProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        title: reminderTitleInput,
        notes: reminderNotesInput,
        dueDate: clinicalDateInput("Due date"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await activePractice(ctx.db, ctx.practiceId);
      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt),
          ),
        )
        .limit(1);
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }
      const [reminder] = await ctx.db
        .insert(careReminders)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          title: input.title,
          notes: input.notes ?? null,
          dueDate: input.dueDate,
          createdBy: ctx.user.id,
        })
        .returning();
      return reminder!;
    }),

  setCompleted: manageProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        completed: z.boolean(),
        expectedUpdatedAt: expectedUpdatedAtInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await activePractice(tx as unknown as Database, ctx.practiceId);
        const [current] = await tx
          .select({
            id: careReminders.id,
            status: careReminders.status,
            updatedAtVersion: careReminderUpdatedAtVersion,
          })
          .from(careReminders)
          .where(
            and(
              eq(careReminders.id, input.id),
              eq(careReminders.practiceId, ctx.practiceId),
              isNull(careReminders.deletedAt),
            ),
          )
          .limit(1)
          .for("update");
        if (!current) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Care reminder not found",
          });
        }
        const targetStatus = input.completed ? "completed" : "open";
        if (current.status === targetStatus) return current;
        if (current.updatedAtVersion !== input.expectedUpdatedAt) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This reminder changed. Refresh before updating it.",
          });
        }
        const now = new Date();
        const [updated] = await tx
          .update(careReminders)
          .set({
            status: targetStatus,
            completedAt: input.completed ? now : null,
            completedBy: input.completed ? ctx.user.id : null,
            updatedAt: now,
          })
          .where(
            and(
              eq(careReminders.id, current.id),
              eq(careReminders.practiceId, ctx.practiceId),
              sql`${careReminders.updatedAt} = ${input.expectedUpdatedAt}::timestamptz`,
              isNull(careReminders.deletedAt),
            ),
          )
          .returning();
        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This reminder changed. Refresh before updating it.",
          });
        }
        return updated;
      });
    }),
});
