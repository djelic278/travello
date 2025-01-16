import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Define user roles
export const UserRole = {
  USER: 'user',
  COMPANY_ADMIN: 'company_admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique().notNull(),
  role: text("role", { enum: Object.values(UserRole) }).default(UserRole.USER).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const travelForms = pgTable("travel_forms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  approverId: integer("approver_id").references(() => users.id),
  submissionLocation: text("submission_location").notNull(),
  submissionDate: timestamp("submission_date").defaultNow().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  destination: text("destination").notNull(),
  tripPurpose: text("trip_purpose").notNull(),
  transportType: text("transport_type").notNull(),
  transportDetails: text("transport_details"),
  startDate: timestamp("start_date").notNull(),
  duration: integer("duration").notNull(),
  isReturnTrip: boolean("is_return_trip").default(true).notNull(),
  projectCode: text("project_code").notNull(),
  requestedPrepayment: decimal("requested_prepayment", { precision: 10, scale: 2 }),
  status: text("status").default('pending').notNull(),
  approvalStatus: text("approval_status", { 
    enum: ['pending', 'approved', 'rejected'] 
  }).default('pending').notNull(),
  approvalDate: timestamp("approval_date"),
  approvalNotes: text("approval_notes"),
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

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { 
    enum: ['form_approval', 'form_approved', 'form_rejected', 'other']
  }).notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  formsSubmitted: many(travelForms, { relationName: "submitter" }),
  formsApproved: many(travelForms, { relationName: "approver" }),
  notifications: many(notifications),
}));

export const travelFormsRelations = relations(travelForms, ({ one, many }) => ({
  user: one(users, {
    fields: [travelForms.userId],
    references: [users.id],
    relationName: "submitter"
  }),
  approver: one(users, {
    fields: [travelForms.approverId],
    references: [users.id],
    relationName: "approver"
  }),
  expenses: many(expenses)
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  form: one(travelForms, {
    fields: [expenses.formId],
    references: [travelForms.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Create schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const insertTravelFormSchema = createInsertSchema(travelForms);
export const selectTravelFormSchema = createSelectSchema(travelForms);
export type InsertTravelForm = typeof travelForms.$inferInsert;
export type SelectTravelForm = typeof travelForms.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expenses);
export const selectExpenseSchema = createSelectSchema(expenses);
export type InsertExpense = typeof expenses.$inferInsert;
export type SelectExpense = typeof expenses.$inferSelect;

export const insertSettingsSchema = createInsertSchema(settings);
export const selectSettingsSchema = createSelectSchema(settings);
export type InsertSettings = typeof settings.$inferInsert;
export type SelectSettings = typeof settings.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;