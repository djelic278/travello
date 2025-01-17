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

// Define the API response type for travel forms
export type TravelFormResponse = {
  id: number;
  firstName: string;
  lastName: string;
  destination: string;
  projectCode: string;
  requestedPrepayment?: number;
  departureTime?: string;
  returnTime?: string;
  emailPreviewUrl?: string;
};

export const postTravelFormSchema = z.object({
  departureTime: z.date(),
  returnTime: z.date(),
  startMileage: z.number().min(0),
  endMileage: z.number().min(0),
  expenses: z.array(expenseSchema),
  files: z.array(z.custom<File>()).optional(),
});

export type PostTravelForm = z.infer<typeof postTravelFormSchema>;
export type Expense = z.infer<typeof expenseSchema>;

export function calculateAllowance(hours: number, dailyAllowance: number = 35): number {
  if (hours < 6) {
    return 0;
  } else if (hours < 12) {
    return dailyAllowance / 2; // Half day allowance
  } else {
    const fullDays = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    let allowance = fullDays * dailyAllowance;

    // Check remaining hours
    if (remainingHours >= 12) {
      allowance += dailyAllowance; // Full day allowance
    } else if (remainingHours >= 6) {
      allowance += dailyAllowance / 2; // Half day allowance
    }

    return allowance;
  }
}

export function calculateDistanceAllowance(kilometers: number, ratePerKm: number = 0.3): number {
  return Math.max(0, kilometers * ratePerKm);
}

export function calculateTotalHours(departure: Date, return_: Date): number {
  const diff = return_.getTime() - departure.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}