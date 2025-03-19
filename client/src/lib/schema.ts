import { z } from "zod";

export const vehicleSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900, "Year must be after 1900"),
  licensePlate: z.string().min(1, "License plate is required"),
  engineType: z.string().min(1, "Engine type is required"),
  enginePower: z.number().min(0, "Engine power must be positive"),
  fuelConsumption: z.number().min(0, "Fuel consumption must be positive"),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']),
  currentMileage: z.number().min(0, "Mileage must be positive"),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type SelectCompanyVehicle = z.infer<typeof vehicleSchema>;

// Schema for inserting/updating vehicles
export const insertCompanyVehicleSchema = vehicleSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  companyId: z.number().default(1)
});

export type InsertCompanyVehicle = z.infer<typeof insertCompanyVehicleSchema>;