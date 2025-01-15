import type { Express, Request, Response, NextFunction } from "express";
import { db } from "@db";
import { travelForms, users } from "@db/schema";
import { eq, and } from "drizzle-orm";
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 4 // Maximum 4 files
  }
});

export function registerRoutes(app: Express) {
  // Wrap all route handlers with error catching
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
    (req: Request, res: Response, next: NextFunction) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };

  // Travel form routes
  app.get("/api/forms", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const forms = await db
      .select()
      .from(travelForms)
      .where(
        req.user.isAdmin 
          ? undefined 
          : eq(travelForms.userId, req.user.id)
      );
    res.json(forms);
  }));

  app.get("/api/forms/:id", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const [form] = await db
      .select()
      .from(travelForms)
      .where(
        and(
          eq(travelForms.id, parseInt(req.params.id)),
          req.user.isAdmin 
            ? undefined 
            : eq(travelForms.userId, req.user.id)
        )
      )
      .limit(1);

    if (!form) {
      return res.status(404).send("Form not found");
    }

    res.json(form);
  }));

  app.post("/api/forms/pre-travel", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const [form] = await db
      .insert(travelForms)
      .values({
        ...req.body,
        userId: req.user.id,
        status: 'pending_approval'
      })
      .returning();
    res.json(form);
  }));

  app.put("/api/forms/:id/post-travel", 
    upload.array('files', 4),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not authenticated");
      }

      const files = (req.files as Express.Multer.File[])?.map(f => f.path) || [];

      const [form] = await db
        .update(travelForms)
        .set({
          ...req.body,
          attachments: files,
          status: 'completed'
        })
        .where(
          and(
            eq(travelForms.id, parseInt(req.params.id)),
            eq(travelForms.userId, req.user.id)
          )
        )
        .returning();

      if (!form) {
        return res.status(404).send("Form not found");
      }

      res.json(form);
    })
  );

  app.put("/api/forms/:id/approve", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Not authorized");
    }

    const [form] = await db
      .update(travelForms)
      .set({ status: 'approved' })
      .where(eq(travelForms.id, parseInt(req.params.id)))
      .returning();

    if (!form) {
      return res.status(404).send("Form not found");
    }

    res.json(form);
  }));
}