import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: text("contact_id").notNull(),
    externalAppointmentId: text("external_appointment_id").notNull(),
    locationId: text("location_id").notNull(),
    appointmentTimestamp: timestamp("appointment_timestamp", {
      withTimezone: true,
    }).notNull(),
    amountCents: integer("amount_cents").notNull().default(2000),
    status: text("status").notNull().default("tallied"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("charges_external_appointment_id_idx").on(
      table.externalAppointmentId,
    ),
    index("charges_location_status_idx").on(table.locationId, table.status),
  ],
);

export const webhookIdempotency = pgTable("webhook_idempotency", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const locations = pgTable("locations", {
  locationId: text("location_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  companyName: text("company_name").notNull(),
  billingEmail: text("billing_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const billingRuns = pgTable("billing_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
  invoiceCount: integer("invoice_count").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  chargesProcessed: integer("charges_processed").notNull().default(0),
});
