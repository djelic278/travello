import { z } from "zod";

// Define base schemas first
export const expenseSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.number().min(0, "Amount must be positive"),
});

// Post Travel Form Schema with strict date handling
export const postTravelFormSchema = z.object({
  departureTime: z.string()
    .min(1, "Departure time is required")
    .refine((val) => {
      try {
        const date = new Date(val);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    }, "Invalid departure time format"),
  returnTime: z.string()
    .min(1, "Return time is required")
    .refine((val) => {
      try {
        const date = new Date(val);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    }, "Invalid return time format"),
  startMileage: z.number().min(0, "Start mileage must be positive"),
  endMileage: z.number().min(0, "End mileage must be positive"),
  expenses: z.array(expenseSchema),
  files: z.array(z.custom<File>((val) => val instanceof File, "Must be a valid file"))
    .max(4, "Maximum 4 files allowed")
    .optional(),
}).refine((data) => {
  try {
    const departure = new Date(data.departureTime);
    const return_ = new Date(data.returnTime);
    return !isNaN(departure.getTime()) && !isNaN(return_.getTime()) && return_ > departure;
  } catch {
    return false;
  }
}, {
  message: "Return time must be after departure time",
  path: ["returnTime"],
});

// Export types
export type PostTravelForm = z.infer<typeof postTravelFormSchema>;
export type Expense = z.infer<typeof expenseSchema>;

// Utility functions for date handling
export function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    // Handle different date formats
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // Check if it's an ISO date string
      dateObj = new Date(date);
      
      // If it's not a valid date, try European date format dd/mm/yyyy
      if (isNaN(dateObj.getTime()) && date.includes('/')) {
        const parts = date.split('/');
        if (parts.length === 3) {
          // Try DD/MM/YYYY format
          dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      
      // If still invalid, try other potential formats
      if (isNaN(dateObj.getTime())) {
        console.error("Invalid date string format:", date);
        return '';
      }
    } else {
      dateObj = date;
    }
    
    if (isNaN(dateObj.getTime())) {
      console.error("Invalid date object:", date);
      return '';
    }
    
    // Format date-time for input (HTML datetime-local format: YYYY-MM-DDThh:mm)
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting date for input:", error, date);
    return '';
  }
}

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  return date;
}

// Calculation functions
export function calculateTotalHours(departure: string | Date, return_: string | Date): number {
  try {
    const departureDate = typeof departure === 'string' ? new Date(departure) : departure;
    const returnDate = typeof return_ === 'string' ? new Date(return_) : return_;

    if (isNaN(departureDate.getTime()) || isNaN(returnDate.getTime())) {
      return 0;
    }
    const diff = returnDate.getTime() - departureDate.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
  } catch {
    return 0;
  }
}

export function calculateAllowance(hours: number, dailyAllowance: number = 35): number {
  if (hours < 6) return 0;
  if (hours < 12) return dailyAllowance / 2;

  const fullDays = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  let allowance = fullDays * dailyAllowance;

  if (remainingHours >= 12) allowance += dailyAllowance;
  else if (remainingHours >= 6) allowance += dailyAllowance / 2;

  return allowance;
}

export function calculateDistanceAllowance(kilometers: number, ratePerKm: number = 0.3): number {
  if (typeof kilometers !== 'number' || typeof ratePerKm !== 'number' ||
      isNaN(kilometers) || isNaN(ratePerKm) ||
      kilometers < 0 || ratePerKm < 0) {
    return 0;
  }
  return Math.max(0, kilometers * ratePerKm);
}

export const preTraveFormSchema = z.object({
  submissionLocation: z.string().min(1, "Submission location is required"),
  submissionDate: z.date(),
  company: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  destination: z.string().min(1, "Destination is required"),
  tripPurpose: z.string().min(1, "Trip purpose is required"),
  transportType: z.string(),
  isCompanyVehicle: z.boolean().default(false),
  companyVehicleId: z.number().optional(),
  transportDetails: z.string().optional(),
  isReturnTrip: z.boolean(),
  startDate: z.date(),
  duration: z.number().min(1, "Duration must be at least 1 day"),
  projectCode: z.string().optional(),
  requestedPrepayment: z.number().min(0, "Prepayment amount must be positive").optional(),
}).refine((data) => {
  if (data.isCompanyVehicle) {
    return true;
  }
  return data.transportType.length > 0;
}, {
  message: "Transport type is required when not using a company vehicle",
  path: ["transportType"],
});

// Export types
export type PreTravelForm = z.infer<typeof preTraveFormSchema>;


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
  projectCode: "The project code to which this travel will be billed (optional)",
  requestedPrepayment: "Amount of money (in EUR) requested as advance payment before the trip",
};