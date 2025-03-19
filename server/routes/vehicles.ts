import { Router } from "express";
import { db } from "@db";
import { companyVehicles, insertCompanyVehicleSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../middleware/auth";

const router = Router();

// Get all vehicles
router.get("/vehicles", isAuthenticated, async (req, res) => {
  try {
    const vehicles = await db.query.companyVehicles.findMany({
      orderBy: (vehicles, { desc }) => [desc(vehicles.createdAt)],
    });
    res.json(vehicles);
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// Get single vehicle
router.get("/vehicles/:id", isAuthenticated, async (req, res) => {
  try {
    const vehicle = await db.query.companyVehicles.findFirst({
      where: eq(companyVehicles.id, parseInt(req.params.id)),
    });
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.json(vehicle);
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
});

// Create new vehicle
router.post("/vehicles", isAuthenticated, async (req, res) => {
  try {
    console.log('Received vehicle data:', req.body); // Debug log

    const parsedData = insertCompanyVehicleSchema.parse({
      ...req.body,
      companyId: 1 // Using default company ID for now
    });

    console.log('Parsed vehicle data:', parsedData); // Debug log

    const [vehicle] = await db.insert(companyVehicles)
      .values({
        ...parsedData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log('Created vehicle:', vehicle); // Debug log
    res.status(201).json(vehicle);
  } catch (error) {
    console.error("Error creating vehicle:", error);
    res.status(500).json({ 
      error: "Failed to create vehicle",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update vehicle
router.put("/vehicles/:id", isAuthenticated, async (req, res) => {
  try {
    const parsedData = insertCompanyVehicleSchema.parse(req.body);
    const [vehicle] = await db
      .update(companyVehicles)
      .set({
        ...parsedData,
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
});

export default router;