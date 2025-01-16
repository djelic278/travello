import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { travelForms, expenses, settings, notifications } from "@db/schema";
import { eq, and } from "drizzle-orm";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Please login to continue");
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is company admin or super admin
const isApprover = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || 
        !(req.user?.role === 'company_admin' || req.user?.role === 'super_admin')) {
      return res.status(403).send("Approver access required");
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Initialize settings if they don't exist
async function initializeSettings() {
  const [existingSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'dailyAllowance'))
    .limit(1);

  if (!existingSetting) {
    await db.insert(settings).values([
      {
        key: 'dailyAllowance',
        value: '35', // Default daily allowance in EUR
      },
      {
        key: 'kilometerRate',
        value: '0.3', // Default kilometer rate in EUR
      }
    ]);
  }
}

// Create notification
async function createNotification(userId: number, title: string, message: string, type: 'form_approval' | 'form_approved' | 'form_rejected' | 'other', metadata?: any) {
  return db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    metadata: metadata ? JSON.stringify(metadata) : null,
  }).returning();
}

// Wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

export function registerRoutes(app: Express): Server {
  // Initialize settings
  initializeSettings().catch(console.error);

  // Get settings
  app.get("/api/settings", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const allSettings = await db.select().from(settings);
    const settingsMap = Object.fromEntries(
      allSettings.map(setting => [setting.key, setting.value])
    );
    res.json(settingsMap);
  }));

  // Update setting (admin only)
  app.put("/api/settings/:key", isAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const { value } = req.body;

    const [updated] = await db
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();

    res.json(updated);
  }));

  // Get all travel forms for the current user or all forms for approvers
  app.get("/api/forms", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const isApprover = req.user?.role === 'company_admin' || req.user?.role === 'super_admin';
    const companyId = req.user?.companyId;

    let forms;
    if (isApprover) {
      // Approvers see forms from their company or all forms for super admin
      forms = await db.query.travelForms.findMany({
        where: req.user?.role === 'super_admin' ? undefined : 
          eq(travelForms.companyId, companyId),
        orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)]
      });
    } else {
      // Regular users only see their own forms
      forms = await db.query.travelForms.findMany({
        where: eq(travelForms.userId, req.user!.id),
        orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)]
      });
    }
    res.json(forms);
  }));

  // Get all pending forms for approval (approvers only)
  app.get("/api/forms/pending", isApprover, asyncHandler(async (req: Request, res: Response) => {
    const forms = await db.query.travelForms.findMany({
      where: eq(travelForms.approvalStatus, 'pending'),
      orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)]
    });
    res.json(forms);
  }));

  // Approve or reject a form
  app.post("/api/forms/:id/approval", isApprover, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ message: "Invalid approval status" });
    }

    // Get the form and check if it can be approved
    const [form] = await db.select().from(travelForms).where(eq(travelForms.id, parseInt(id)));

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    if (form.approvalStatus !== 'pending') {
      return res.status(400).json({ message: "Form is not pending approval" });
    }

    // Update form status
    const [updatedForm] = await db
      .update(travelForms)
      .set({
        approvalStatus: status,
        approvalDate: new Date(),
        approvalNotes: notes,
        approverId: req.user!.id
      })
      .where(eq(travelForms.id, parseInt(id)))
      .returning();

    // Create notification for the form owner
    await createNotification(
      form.userId,
      `Travel Form ${status.toUpperCase()}`,
      `Your travel form for ${form.destination} has been ${status}${notes ? ': ' + notes : ''}`,
      status === 'approved' ? 'form_approved' : 'form_rejected',
      { formId: form.id }
    );

    res.json(updatedForm);
  }));

  // Get notifications for the current user
  app.get("/api/notifications", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.user!.id),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)]
    });
    res.json(userNotifications);
  }));

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const [notification] = await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, parseInt(id)),
        eq(notifications.userId, req.user!.id)
      ))
      .returning();

    res.json(notification);
  }));


  // Get unique submission locations for the current user
  app.get("/api/submission-locations", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const locations = await db.query.travelForms.findMany({
      where: eq(travelForms.userId, req.user!.id),
      columns: {
        submissionLocation: true
      },
      limit: 10
    });

    // Use Array.from to convert locations to an array and filter unique values
    const uniqueLocations = Array.from(
      new Set(locations.map(l => l.submissionLocation))
    );
    res.json(uniqueLocations);
  }));

  // Get a specific travel form
  app.get("/api/forms/:id", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const form = await db.query.travelForms.findFirst({
      where: and(
        eq(travelForms.id, parseInt(req.params.id)),
        eq(travelForms.userId, req.user!.id)
      )
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.json(form);
  }));

  // Create new travel form (pre-travel)
  app.post("/api/forms/pre-travel", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const [form] = await db
      .insert(travelForms)
      .values({
        userId: req.user!.id,
        submissionLocation: req.body.submissionLocation,
        submissionDate: new Date(req.body.submissionDate),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        destination: req.body.destination,
        tripPurpose: req.body.tripPurpose,
        transportType: req.body.transportType,
        transportDetails: req.body.transportDetails,
        startDate: new Date(req.body.startDate),
        duration: req.body.duration,
        isReturnTrip: req.body.isReturnTrip,
        projectCode: req.body.projectCode,
        requestedPrepayment: req.body.requestedPrepayment,
        approvalStatus: 'pending', // Changed from 'approved'
        companyId: req.user?.companyId // Add company ID
      })
      .returning();
    res.json(form);
  }));

  // Update travel form with post-travel details
  app.put("/api/forms/:id/post-travel", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const { departureTime, returnTime, startMileage, endMileage, expenses: expenseItems } = req.body;

    // Ensure the form belongs to the current user
    const existingForm = await db.query.travelForms.findFirst({
      where: and(
        eq(travelForms.id, parseInt(req.params.id)),
        eq(travelForms.userId, req.user!.id)
      )
    });

    if (!existingForm) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Update the travel form
    const [updatedForm] = await db
      .update(travelForms)
      .set({
        departureTime: new Date(departureTime),
        returnTime: new Date(returnTime),
        startMileage,
        endMileage,
        approvalStatus: 'submitted',  // Changed from 'completed' to 'submitted'
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