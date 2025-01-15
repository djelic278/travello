import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { travelForms, users } from "@db/schema";
import { eq, and } from "drizzle-orm";
import multer from 'multer';
import path from 'path';
import express from 'express';

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export function registerRoutes(app: Express): Server {
  // Set up static file serving for uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Travel form routes
  app.get("/api/forms", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const forms = await db
        .select()
        .from(travelForms)
        .where(
          req.user.isAdmin 
            ? undefined 
            : eq(travelForms.userId, req.user.id)
        );
      res.json(forms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      res.status(500).send("Error fetching forms");
    }
  });

  app.get("/api/forms/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
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
    } catch (error) {
      console.error('Error fetching form:', error);
      res.status(500).send("Error fetching form");
    }
  });

  app.post("/api/forms/pre-travel", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [form] = await db
        .insert(travelForms)
        .values({
          ...req.body,
          userId: req.user.id,
          status: 'pending_approval'
        })
        .returning();
      res.json(form);
    } catch (error) {
      console.error('Error creating form:', error);
      res.status(500).send("Error creating form");
    }
  });

  app.put("/api/forms/:id/post-travel", upload.array('files', 4), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { id } = req.params;
    const files = (req.files as Express.Multer.File[])?.map(f => f.path) || [];

    try {
      const [form] = await db
        .update(travelForms)
        .set({
          ...req.body,
          attachments: files,
          status: 'completed'
        })
        .where(
          and(
            eq(travelForms.id, parseInt(id)),
            eq(travelForms.userId, req.user.id)
          )
        )
        .returning();

      if (!form) {
        return res.status(404).send("Form not found");
      }

      res.json(form);
    } catch (error) {
      console.error('Error updating form:', error);
      res.status(500).send("Error updating form");
    }
  });

  app.put("/api/forms/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Not authorized");
    }

    const { id } = req.params;

    try {
      const [form] = await db
        .update(travelForms)
        .set({ status: 'approved' })
        .where(eq(travelForms.id, parseInt(id)))
        .returning();

      if (!form) {
        return res.status(404).send("Form not found");
      }

      res.json(form);
    } catch (error) {
      console.error('Error approving form:', error);
      res.status(500).send("Error approving form");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}