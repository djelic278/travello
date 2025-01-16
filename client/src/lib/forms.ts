import { z } from "zod";

export const preTraveFormSchema = z.object({
  submissionLocation: z.string().min(1, "Submission location is required"),
  submissionDate: z.date(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  destination: z.string().min(1, "Destination is required"),
  tripPurpose: z.string().min(1, "Trip purpose is required"),
  transportType: z.string().min(1, "Transport type is required"),
  transportDetails: z.string().optional(),
  isReturnTrip: z.boolean(),
  startDate: z.date(),
  duration: z.number().min(1, "Duration must be at least 1 day"),
  projectCode: z.string().min(1, "Project code is required"),
  requestedPrepayment: z.number().min(0, "Prepayment amount must be positive").optional(),
});

export type PreTravelForm = z.infer<typeof preTraveFormSchema>;

// Field descriptions for tooltips
export const fieldDescriptions = {
  submissionLocation: "Current location where you are submitting this travel request form",
  submissionDate: "Current date when this form is being submitted",
  firstName: "Your legal first name as it appears in your ID documents",
  lastName: "Your legal last name as it appears in your ID documents",
  destination: "The city or location where you will be traveling to",
  tripPurpose: "Brief description of why this trip is necessary and its business objectives",
  transportType: "Mode of transportation you plan to use (e.g., car, train, bus, plane)",
  transportDetails: "If using a car, enter the vehicle type and registration number",
  isReturnTrip: "Indicate if you will return to your starting location",
  startDate: "The date when your travel will begin",
  duration: "Number of days you plan to stay",
  projectCode: "The project code to which this travel will be billed",
  requestedPrepayment: "Amount of money (in EUR) requested as advance payment before the trip",
};

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