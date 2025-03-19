import { z } from "zod";

// Define base schemas first
export const expenseSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.number().min(0, "Amount must be positive"),
});

export const preTraveFormSchema = z.object({
  submissionLocation: z.string().min(1, "Submission location is required"),
  submissionDate: z.date(),
  company: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  destination: z.string().min(1, "Destination is required"),
  tripPurpose: z.string().min(1, "Trip purpose is required"),
  transportType: z.string().min(1, "Transport type is required"),
  isCompanyVehicle: z.boolean().default(false),
  companyVehicleId: z.number().optional(),
  transportDetails: z.string().optional(),
  isReturnTrip: z.boolean(),
  startDate: z.date(),
  duration: z.number().min(1, "Duration must be at least 1 day"),
  projectCode: z.string().min(1, "Project code is required"),
  requestedPrepayment: z.number().min(0, "Prepayment amount must be positive").optional(),
});

export const postTravelFormSchema = z.object({
  departureTime: z.date(),
  returnTime: z.date(),
  startMileage: z.number().min(0, "Start mileage must be positive"),
  endMileage: z.number().min(0, "End mileage must be positive"),
  expenses: z.array(expenseSchema),
  files: z.array(z.custom<File>((val) => val instanceof File, "Must be a valid file")).max(4, "Maximum 4 files allowed").optional(),
}).refine((data) => {
  if (data.departureTime && data.returnTime) {
    const departure = new Date(data.departureTime);
    const return_ = new Date(data.returnTime);
    if (return_ < departure) {
      throw new Error("Return time must be after departure time");
    }
  }
  return true;
}, {
  message: "Return time must be after departure time",
  path: ["returnTime"],
});

// Export types
export type PreTravelForm = z.infer<typeof preTraveFormSchema>;
export type PostTravelForm = z.infer<typeof postTravelFormSchema>;
export type Expense = z.infer<typeof expenseSchema>;

// Field descriptions for tooltips
export const fieldDescriptions = {
  submissionLocation: "Current location where you are submitting this travel request form",
  submissionDate: "Current date when this form is being submitted",
  company: "Your company affiliation",
  firstName: "Your legal first name as it appears in your ID documents",
  lastName: "Your legal last name as it appears in your ID documents",
  destination: "The city or location where you will be traveling to",
  tripPurpose: "Brief description of why this trip is necessary and its business objectives",
  transportType: "Mode of transportation you plan to use (e.g., car, train, bus, plane)",
  isCompanyVehicle: "Check if you are using a company vehicle",
  companyVehicleId: "Select the company vehicle you will be using",
  transportDetails: "Additional transport details or private vehicle information",
  isReturnTrip: "Indicate if you will return to your starting location",
  startDate: "The date when your travel will begin",
  duration: "Number of days you plan to stay",
  projectCode: "The project code to which this travel will be billed",
  requestedPrepayment: "Amount of money (in EUR) requested as advance payment before the trip",
};

// Utility functions
export function calculateAllowance(hours: number, dailyAllowance: number = 35): number {
  if (typeof hours !== 'number' || isNaN(hours) || hours < 0) {
    return 0;
  }

  if (hours < 6) {
    return 0;
  } else if (hours < 12) {
    return dailyAllowance / 2;
  } else {
    const fullDays = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    let allowance = fullDays * dailyAllowance;
    if (remainingHours >= 12) {
      allowance += dailyAllowance;
    } else if (remainingHours >= 6) {
      allowance += dailyAllowance / 2;
    }
    return allowance;
  }
}

export function calculateDistanceAllowance(kilometers: number, ratePerKm: number = 0.3): number {
  if (typeof kilometers !== 'number' || typeof ratePerKm !== 'number' ||
      isNaN(kilometers) || isNaN(ratePerKm) ||
      kilometers < 0 || ratePerKm < 0) {
    return 0;
  }
  return Math.max(0, kilometers * ratePerKm);
}

export function calculateTotalHours(departure: Date, return_: Date): number {
  if (!(departure instanceof Date) || !(return_ instanceof Date) ||
      isNaN(departure.getTime()) || isNaN(return_.getTime())) {
    return 0;
  }
  const diff = return_.getTime() - departure.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}