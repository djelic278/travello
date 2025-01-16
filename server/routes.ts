import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { travelForms, expenses } from "@db/schema";
import { eq } from "drizzle-orm";

// Wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

export function registerRoutes(app: Express): Server {
  // Get all travel forms
  app.get("/api/forms", asyncHandler(async (_req: Request, res: Response) => {
    const forms = await db.select().from(travelForms);
    res.json(forms);
  }));

  // Get unique submission locations
  app.get("/api/submission-locations", asyncHandler(async (_req: Request, res: Response) => {
    const locations = await db
      .select({ location: travelForms.submissionLocation })
      .from(travelForms)
      .groupBy(travelForms.submissionLocation)
      .limit(10);

    res.json(locations.map(l => l.location));
  }));

  // Get a specific travel form
  app.get("/api/forms/:id", asyncHandler(async (req: Request, res: Response) => {
    const form = await db
      .select()
      .from(travelForms)
      .where(eq(travelForms.id, parseInt(req.params.id)))
      .limit(1);

    if (!form.length) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.json(form[0]);
  }));

  // Create new travel form (pre-travel)
  app.post("/api/forms/pre-travel", asyncHandler(async (req: Request, res: Response) => {
    const [form] = await db
      .insert(travelForms)
      .values({
        submissionLocation: req.body.submissionLocation,
        submissionDate: new Date(req.body.submissionDate),
        destination: req.body.destination,
        startDate: new Date(req.body.startDate),
        duration: req.body.duration,
        isReturnTrip: req.body.isReturnTrip,
        projectCode: req.body.projectCode,
        status: 'pending',
      })
      .returning();
    res.json(form);
  }));

  // Update travel form with post-travel details
  app.put("/api/forms/:id/post-travel", asyncHandler(async (req: Request, res: Response) => {
    const { departureTime, returnTime, startMileage, endMileage, expenses: expenseItems } = req.body;

    // Update the travel form
    const [updatedForm] = await db
      .update(travelForms)
      .set({
        departureTime: new Date(departureTime),
        returnTime: new Date(returnTime),
        startMileage,
        endMileage,
        status: 'completed',
      })
      .where(eq(travelForms.id, parseInt(req.params.id)))
      .returning();

    // Add expenses if provided
    if (expenseItems?.length) {
      await db.insert(expenses).values(
        expenseItems.map((expense: any) => ({
          formId: updatedForm.id,
          name: expense.name,
          amount: expense.amount,
        }))
      );
    }

    res.json(updatedForm);
  }));

  const httpServer = createServer(app);
  return httpServer;
}