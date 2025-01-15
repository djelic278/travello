import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from 'zod';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const travelForms = pgTable("travel_forms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default('draft'),
  
  // Form 1 - Pre-travel
  destination: text("destination").notNull(),
  isReturnTrip: boolean("is_return_trip").notNull(),
  startDate: timestamp("start_date").notNull(),
  duration: integer("duration").notNull(),
  projectCode: text("project_code").notNull(),
  
  // Form 2 - Post-travel
  departureTime: timestamp("departure_time"),
  returnTime: timestamp("return_time"),
  startMileage: decimal("start_mileage", { precision: 10, scale: 2 }),
  endMileage: decimal("end_mileage", { precision: 10, scale: 2 }),
  attachments: jsonb("attachments").$type<string[]>(),
  expenses: jsonb("expenses").$type<{name: string, amount: number}[]>(),
  
  calculatedHours: decimal("calculated_hours", { precision: 10, scale: 2 }),
  calculatedAllowance: decimal("calculated_allowance", { precision: 10, scale: 2 }),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  forms: many(travelForms),
}));

export const travelFormsRelations = relations(travelForms, ({ one }) => ({
  user: one(users, {
    fields: [travelForms.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const insertTravelFormSchema = createInsertSchema(travelForms);
export const selectTravelFormSchema = createSelectSchema(travelForms);
export type InsertTravelForm = typeof travelForms.$inferInsert;
export type SelectTravelForm = typeof travelForms.$inferSelect;
