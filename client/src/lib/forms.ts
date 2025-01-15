import { z } from "zod";

export const preTraveFormSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  isReturnTrip: z.boolean(),
  startDate: z.date(),
  duration: z.number().min(1, "Duration must be at least 1 day"),
  projectCode: z.string().min(1, "Project code is required"),
});

export type PreTravelForm = z.infer<typeof preTraveFormSchema>;

export const expenseSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.number().min(0, "Amount must be positive"),
});

export const postTravelFormSchema = z.object({
  departureTime: z.date(),
  returnTime: z.date(),
  startMileage: z.number().min(0),
  endMileage: z.number().min(0),
  expenses: z.array(expenseSchema),
});

export type PostTravelForm = z.infer<typeof postTravelFormSchema>;
export type Expense = z.infer<typeof expenseSchema>;

export function calculateAllowance(hours: number): number {
  const fullDays = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const dailyRate = 70; // 35 EUR per 12 hours

  let allowance = fullDays * dailyRate;
  if (remainingHours >= 12) {
    allowance += 35;
  }

  return allowance;
}

export function calculateTotalHours(departure: Date, return_: Date): number {
  const diff = return_.getTime() - departure.getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}