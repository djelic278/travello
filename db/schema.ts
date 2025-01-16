import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const travelForms = pgTable("travel_forms", {
  id: serial("id").primaryKey(),
  submissionLocation: text("submission_location").notNull(),
  submissionDate: timestamp("submission_date").defaultNow().notNull(),
  destination: text("destination").notNull(),
  startDate: timestamp("start_date").notNull(),
  duration: integer("duration").notNull(),
  isReturnTrip: boolean("is_return_trip").default(true).notNull(),
  projectCode: text("project_code").notNull(),
  status: text("status").default('pending').notNull(),
  departureTime: timestamp("departure_time"),
  returnTime: timestamp("return_time"),
  startMileage: decimal("start_mileage", { precision: 10, scale: 2 }),
  endMileage: decimal("end_mileage", { precision: 10, scale: 2 }),
  allowanceAmount: decimal("allowance_amount", { precision: 10, scale: 2 }),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").references(() => travelForms.id).notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTravelFormSchema = createInsertSchema(travelForms);
export const selectTravelFormSchema = createSelectSchema(travelForms);
export type InsertTravelForm = typeof travelForms.$inferInsert;
export type SelectTravelForm = typeof travelForms.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expenses);
export const selectExpenseSchema = createSelectSchema(expenses);
export type InsertExpense = typeof expenses.$inferInsert;
export type SelectExpense = typeof expenses.$inferSelect;