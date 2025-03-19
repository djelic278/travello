import { Router } from "express";
import { db } from "@db";
import { companyVehicles, insertCompanyVehicleSchema } from "@db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Get all vehicles
router.get("/vehicles", async (req, res) => {
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
router.get("/vehicles/:id", async (req, res) => {
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
router.post("/vehicles", async (req, res) => {
  try {
    const vehicleData = insertCompanyVehicleSchema.parse({
      ...req.body,
      companyId: req.user!.companyId
    });
    const vehicle = await db.insert(companyVehicles).values(vehicleData).returning();
    res.status(201).json(vehicle[0]);
  } catch (error) {
    console.error("Error creating vehicle:", error);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// Update vehicle
router.put("/vehicles/:id", async (req, res) => {
  try {
    const vehicleData = insertCompanyVehicleSchema.parse(req.body);
    const vehicle = await db
      .update(companyVehicles)
      .set(vehicleData)
      .where(eq(companyVehicles.id, parseInt(req.params.id)))
      .returning();
    if (!vehicle.length) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.json(vehicle[0]);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

export default router;