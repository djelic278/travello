import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const travelForms = pgTable("travel_forms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  destination: text("destination").notNull(),
  startDate: timestamp("start_date").notNull(),
  duration: integer("duration").notNull(),
  status: text("status").default('pending').notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const insertTravelFormSchema = createInsertSchema(travelForms);
export const selectTravelFormSchema = createSelectSchema(travelForms);
export type InsertTravelForm = typeof travelForms.$inferInsert;
export type SelectTravelForm = typeof travelForms.$inferSelect;