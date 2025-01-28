import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Define user roles as a const to ensure type safety
export const UserRole = {
  USER: 'user',
  COMPANY_ADMIN: 'company_admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

// Define theme options
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

export type ThemeModeType = (typeof ThemeMode)[keyof typeof ThemeMode];

// Define invitation types
export const InvitationType = {
  COMPANY_ADMIN: 'company_admin',
} as const;

export type InvitationTypeType = (typeof InvitationType)[keyof typeof InvitationType];

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique().notNull(),
  preferredEmail: text("preferred_email"),
  position: text("position"),
  dateOfBirth: date("date_of_birth"),
  role: text("role", { enum: [UserRole.USER, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN] })
    .default(UserRole.USER)
    .notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  theme: text("theme", { enum: [ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM] })
    .default(ThemeMode.SYSTEM)
    .notNull(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  dashboardLayout: jsonb("dashboard_layout").$type<{ type: string }>(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const travelForms = pgTable("travel_forms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
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
  status: text("status", {
    enum: ['pre_travel_submitted', 'post_travel_submitted', 'completed']
  }).default('pre_travel_submitted').notNull(),
  approvalStatus: text("approval_status", {
    enum: ['pending', 'approved', 'rejected']
  }).default('approved').notNull(), // Default to approved
  departureTime: timestamp("departure_time"),
  returnTime: timestamp("return_time"),
  startMileage: decimal("start_mileage", { precision: 10, scale: 2 }),
  endMileage: decimal("end_mileage", { precision: 10, scale: 2 }),
  allowanceAmount: decimal("allowance_amount", { precision: 10, scale: 2 }),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").references(() => travelForms.id).notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create expense type
export type TravelExpense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ['form_submitted', 'form_completed', 'other']
  }).notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add invitations table
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  type: text("type", { enum: [InvitationType.COMPANY_ADMIN] }).notNull(),
  token: text("token").unique().notNull(),
  status: text("status", { enum: ['pending', 'accepted', 'expired'] }).default('pending').notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  forms: many(travelForms),
}));

export const travelFormsRelations = relations(travelForms, ({ one, many }) => ({
  user: one(users, {
    fields: [travelForms.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [travelForms.companyId],
    references: [companies.id],
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

// Create schemas for validation
export const updateUserProfileSchema = z.object({
  position: z.string().min(1, "Position is required"),
  dateOfBirth: z.string().optional(),
  preferredEmail: z.string().email("Invalid email address"),
  companyId: z.number().optional(),
  theme: z.enum([ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM]).optional(),
  emailNotifications: z.boolean().optional(),
  dashboardLayout: z.object({ type: z.string() }).optional(),
});

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

// Add invitation schema
export const insertInvitationSchema = createInsertSchema(invitations);
export const selectInvitationSchema = createSelectSchema(invitations);
export type InsertInvitation = typeof invitations.$inferInsert;
export type SelectInvitation = typeof invitations.$inferSelect;

// Validation schema for sending invitations
export const sendInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  type: z.enum([InvitationType.COMPANY_ADMIN]),
});