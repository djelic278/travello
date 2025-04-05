import { Router } from "express";
import { db } from "@db";
import { companyVehicles, insertCompanyVehicleSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Get all vehicles
router.get("/api/vehicles", isAuthenticated, asyncHandler(async (req, res) => {
  const vehicles = await db.query.companyVehicles.findMany({
    orderBy: (vehicles, { desc }) => [desc(vehicles.createdAt)],
  });
  res.json(vehicles);
}));

// Create new vehicle
router.post("/api/vehicles", isAuthenticated, asyncHandler(async (req, res) => {
  try {
    console.log('Received vehicle data:', req.body);

    // Convert string values to numbers before validation
    const dataToValidate = {
      ...req.body,
      enginePower: parseInt(req.body.enginePower),
      fuelConsumption: parseFloat(req.body.fuelConsumption),
      currentMileage: parseFloat(req.body.currentMileage),
      year: parseInt(req.body.year),
      // Use the companyId from the request or from the user if one is not provided
      companyId: req.body.companyId || (req.user && 'companyId' in req.user ? req.user.companyId : 1),
    };

    // Validate the data
    const validatedData = await insertCompanyVehicleSchema.parseAsync(dataToValidate);
    console.log('Validated vehicle data:', validatedData);

    // Insert into database
    const [vehicle] = await db.insert(companyVehicles)
      .values(validatedData)
      .returning();

    console.log('Created vehicle:', vehicle);
    res.status(201).json(vehicle);
  } catch (error) {
    console.error("Error creating vehicle:", error);

    // If it's a validation error, send the validation messages
    if (error.errors) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors
      });
    }

    // For other errors
    res.status(500).json({ 
      error: "Failed to create vehicle",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Get single vehicle
router.get("/api/vehicles/:id", isAuthenticated, asyncHandler(async (req, res) => {
  const vehicle = await db.query.companyVehicles.findFirst({
    where: eq(companyVehicles.id, parseInt(req.params.id)),
  });

  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  res.json(vehicle);
}));

// Update vehicle
router.put("/api/vehicles/:id", isAuthenticated, asyncHandler(async (req, res) => {
  try {
    const validatedData = await insertCompanyVehicleSchema.parseAsync({
      ...req.body,
      enginePower: parseInt(req.body.enginePower),
      fuelConsumption: parseFloat(req.body.fuelConsumption),
      currentMileage: parseFloat(req.body.currentMileage),
      year: parseInt(req.body.year),
      // Keep the company ID from the request or use the user's company ID as fallback
      companyId: req.body.companyId || (req.user && 'companyId' in req.user ? req.user.companyId : null),
    });

    const [vehicle] = await db
      .update(companyVehicles)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(companyVehicles.id, parseInt(req.params.id)))
      .returning();

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.json(vehicle);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
}));

// Delete vehicle
router.delete("/api/vehicles/:id", isAuthenticated, asyncHandler(async (req, res) => {
  const [deletedVehicle] = await db
    .delete(companyVehicles)
    .where(eq(companyVehicles.id, parseInt(req.params.id)))
    .returning();

  if (!deletedVehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  res.json({ message: "Vehicle deleted successfully" });
}));

export default router;