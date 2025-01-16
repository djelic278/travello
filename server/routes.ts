import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, updateUserProfileSchema } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import { travelForms, expenses, settings, notifications, companies, invitations, sendInvitationSchema } from "@db/schema";
import { randomBytes } from "crypto";
import { sendInvitationEmail } from './email';

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Not logged in");
  }
  next();
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
async function createNotification(userId: number, title: string, message: string, type: string, metadata?: any) {
  const [notification] = await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    metadata: metadata ? metadata : null,
  }).returning();

  return notification;
}

export function registerRoutes(app: Express): Server {
  // Get all travel forms for the current user
  app.get("/api/forms", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const forms = await db.query.travelForms.findMany({
      where: eq(travelForms.userId, req.user!.id),
      orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)],
      with: {
        expenses: true,
      }
    });
    res.json(forms);
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
        status: 'pre_travel_submitted',
        approvalStatus: 'approved', // Automatically approved
        companyId: req.user?.companyId
      })
      .returning();

    // Create notification for the user
    const notification = await createNotification(
      req.user!.id,
      'Travel Form Submitted',
      `Your pre-travel form for ${form.destination} has been automatically approved`,
      'form_submitted',
      { formId: form.id }
    );

    // Send real-time notification via WebSocket setup
    if (req.app.get('sendNotification')) {
      const sendNotification = req.app.get('sendNotification');
      sendNotification(form.userId, notification);
    }

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
        status: 'completed',
        approvalStatus: 'approved', // Automatically approved
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

    // Create notification for the form update
    const notification = await createNotification(
      req.user!.id,
      'Travel Form Completed',
      `Your travel form for ${updatedForm.destination} has been completed and automatically approved`,
      'form_completed',
      { formId: updatedForm.id }
    );

    // Send real-time notification via WebSocket setup
    if (req.app.get('sendNotification')) {
      const sendNotification = req.app.get('sendNotification');
      sendNotification(updatedForm.userId, notification);
    }

    res.json(updatedForm);
  }));

  // Get notifications for the current user
  app.get("/api/notifications", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const notifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.user!.id),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)]
    });
    res.json(notifications);
  }));

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const [notification] = await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, parseInt(req.params.id)),
        eq(notifications.userId, req.user!.id)
      ))
      .returning();

    res.json(notification);
  }));

  // Get all companies
  app.get("/api/companies", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const companies = await db.query.companies.findMany({
      orderBy: (companies, { asc }) => [asc(companies.name)]
    });
    res.json(companies);
  }));

  // Add new company
  app.post("/api/companies", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const { name, address } = req.body;

    // Check if company exists
    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.name, name))
      .limit(1);

    if (existingCompany) {
      return res.status(400).json({ message: "Company already exists" });
    }

    const [company] = await db
      .insert(companies)
      .values({
        name,
        address,
      })
      .returning();

    res.json(company);
  }));

  // Update user profile
  app.put("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const result = updateUserProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { companyId, ...otherData } = result.data;

      // Only allow company changes for super admins
      if (companyId !== undefined && req.user?.role !== 'super_admin') {
        return res.status(403).send("Only super admins can change company assignments");
      }

      // Update user profile with validation
      const [updatedUser] = await db
        .update(users)
        .set({
          ...otherData,
          ...(req.user?.role === 'super_admin' ? { companyId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      res.status(500).send(error.message || 'Error updating profile');
    }
  });

  // Send invitation (super admin only)
  app.post("/api/invitations", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can send invitations");
    }

    // Validate invitation data
    const result = sendInvitationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
    }

    const { email, type } = result.data;

    // Check if invitation already exists
    const [existingInvitation] = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.email, email),
        eq(invitations.status, 'pending')
      ))
      .limit(1);

    if (existingInvitation) {
      return res.status(400).send("An invitation is already pending for this email");
    }

    // Generate a unique token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    const [invitation] = await db.insert(invitations).values({
      email,
      type,
      token,
      expiresAt,
    }).returning();

    // Send invitation email
    const emailResult = await sendInvitationEmail(email, token);

    if (!emailResult.success) {
      // If email fails, still return success but with a warning
      // In production, you might want to handle this differently
      return res.json({
        message: "Invitation created but email delivery failed. Please check logs.",
        invitation: {
          email: invitation.email,
          type: invitation.type,
          expiresAt: invitation.expiresAt,
        },
        emailPreviewUrl: emailResult.previewUrl
      });
    }

    res.json({
      message: "Invitation sent successfully",
      invitation: {
        email: invitation.email,
        type: invitation.type,
        expiresAt: invitation.expiresAt,
      },
      emailPreviewUrl: emailResult.previewUrl
    });
  }));


  // Initialize settings
  initializeSettings().catch(console.error);

  const server = createServer(app);
  const { sendNotification } = setupWebSocket(server, app);
  app.set('sendNotification', sendNotification);

  return server;
}

// Wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };