import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: text("contact_id").notNull(),
    externalAppointmentId: text("external_appointment_id").notNull(),
    locationId: text("location_id").notNull(),
    appointmentTimestamp: timestamp("appointment_timestamp", { withTimezone: true }).notNull(),
    amountCents: integer("amount_cents").notNull().default(2000),
    status: text("status").notNull().default("tallied"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("charges_external_appointment_id_idx").on(
      table.externalAppointmentId,
    ),
  ],
);

export const webhookIdempotency = pgTable("webhook_idempotency", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
