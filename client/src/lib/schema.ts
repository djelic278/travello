import { z } from "zod";

export const vehicleSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  manufacturer: z.string(),
  model: z.string(),
  year: z.number(),
  licensePlate: z.string(),
  engineType: z.string(),
  enginePower: z.number(),
  fuelConsumption: z.number(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']),
  currentMileage: z.number(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type SelectCompanyVehicle = z.infer<typeof vehicleSchema>;

export const insertCompanyVehicleSchema = vehicleSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
