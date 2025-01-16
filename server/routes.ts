import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { travelForms } from "@db/schema";
import { eq } from "drizzle-orm";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Middleware to check if user is authenticated
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }
    next();
  };

  // Wrap async route handlers
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };

  // Get all travel forms for the current user
  app.get("/api/forms", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const forms = await db
      .select()
      .from(travelForms)
      .where(eq(travelForms.userId, req.user!.id));
    res.json(forms);
  }));

  // Create new travel form (pre-travel)
  app.post("/api/forms/pre-travel", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const [form] = await db
      .insert(travelForms)
      .values({
        userId: req.user!.id,
        destination: req.body.destination,
        startDate: new Date(req.body.startDate),
        duration: req.body.duration,
        status: 'pending',
      })
      .returning();
    res.json(form);
  }));

  const httpServer = createServer(app);
  return httpServer;
}