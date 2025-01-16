import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, updateUserProfileSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import type { InsertInvitation } from "@db/schema";
import { travelForms, expenses, settings, notifications, companies, invitations } from "@db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { randomBytes } from "crypto";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Not logged in");
  }
  next();
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

// Middleware to check if user is super admin
const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || req.user?.role !== 'super_admin') {
      return res.status(403).send("Super admin access required");
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is company admin
const isCompanyAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || req.user?.role !== 'company_admin') {
      return res.status(403).send("Company admin access required");
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

// Create notification and send via WebSocket
async function createNotification(userId: number, title: string, message: string, type: 'form_approval' | 'form_approved' | 'form_rejected' | 'other', metadata?: any) {
  const [notification] = await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    metadata: metadata ? JSON.stringify(metadata) : null,
  }).returning();

  return notification;
}

// Wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

export function registerRoutes(app: Express): Server {
  const server = createServer(app);
  const { sendNotification } = setupWebSocket(server, app);

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

  // Send invitation (super admin for company admins, company admin for employees)
  app.post("/api/invitations", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const { email, type, companyId } = req.body;

    // Validate invitation type based on user role
    if (type === 'company_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can invite company administrators");
    }

    if (type === 'employee' && req.user?.role !== 'company_admin') {
      return res.status(403).send("Only company admins can invite employees");
    }

    // For company admins, ensure they can only invite to their own company
    if (req.user?.role === 'company_admin' && companyId !== req.user?.companyId) {
      return res.status(403).send("Company admins can only invite to their own company");
    }

    // Generate a unique token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    const [invitation] = await db.insert(invitations).values({
      email,
      type,
      token,
      companyId,
      invitedBy: req.user!.id,
      expiresAt,
    }).returning();

    // TODO: Send email with invitation link
    // For now, just return the invitation details
    res.json(invitation);
  }));

  // Get invitations (for company admins and super admins)
  app.get("/api/invitations", isApprover, asyncHandler(async (req: Request, res: Response) => {
    const query = db.select().from(invitations);

    // Company admins can only see invitations for their company
    if (req.user?.role === 'company_admin') {
      query.where(eq(invitations.companyId, req.user.companyId));
    }

    const allInvitations = await query;
    res.json(allInvitations);
  }));

  // Accept invitation
  app.post("/api/invitations/:token/accept", asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { username, password } = req.body;

    // Find and validate invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.token, token),
        eq(invitations.status, 'pending')
      ))
      .limit(1);

    if (!invitation) {
      return res.status(404).send("Invalid or expired invitation");
    }

    if (new Date() > invitation.expiresAt) {
      await db
        .update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitation.id));
      return res.status(400).send("Invitation has expired");
    }

    // Create new user with appropriate role and company
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        password, // Note: This should be hashed in auth.ts
        email: invitation.email,
        role: invitation.type === 'company_admin' ? 'company_admin' : 'user',
        companyId: invitation.companyId,
        isAdmin: invitation.type === 'company_admin',
      })
      .returning();

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    // Create notification for the inviter
    const notification = await createNotification(
      invitation.invitedBy,
      'Invitation Accepted',
      `${invitation.email} has accepted your invitation`,
      'other'
    );

    // Send real-time notification
    sendNotification(invitation.invitedBy, notification);

    res.json({ message: "Invitation accepted successfully" });
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

    // Create notification and send via WebSocket
    const notification = await createNotification(
      form.userId,
      `Travel Form ${status.toUpperCase()}`,
      `Your travel form for ${form.destination} has been ${status}${notes ? ': ' + notes : ''}`,
      status === 'approved' ? 'form_approved' : 'form_rejected',
      { formId: form.id }
    );

    // Send real-time notification
    sendNotification(form.userId, notification);

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

  // Add this new endpoint after the other routes
  app.get("/api/forms/export", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const isApprover = req.user?.role === 'company_admin' || req.user?.role === 'super_admin';
    const companyId = req.user?.companyId;

    // Fetch forms based on user role
    let forms;
    if (isApprover) {
      forms = await db.query.travelForms.findMany({
        where: req.user?.role === 'super_admin' ? undefined :
          eq(travelForms.companyId, companyId),
        with: {
          user: true,
          expenses: true,
        },
        orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)]
      });
    } else {
      forms = await db.query.travelForms.findMany({
        where: eq(travelForms.userId, req.user!.id),
        with: {
          user: true,
          expenses: true,
        },
        orderBy: (travelForms, { desc }) => [desc(travelForms.createdAt)]
      });
    }

    // Transform data for Excel
    const excelData = forms.map(form => ({
      'Form ID': form.id,
      'Submission Date': form.submissionDate.toLocaleDateString(),
      'Employee': `${form.user?.firstName} ${form.user?.lastName}`,
      'Destination': form.destination,
      'Purpose': form.tripPurpose,
      'Start Date': form.startDate.toLocaleDateString(),
      'Duration (days)': form.duration,
      'Status': form.approvalStatus,
      'Total Expenses': form.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0).toFixed(2),
      'Travel Allowance': form.allowanceAmount?.toString() || '0',
      'Project Code': form.projectCode,
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Travel Forms");

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=travel-forms.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send file
    res.send(excelBuffer);
  }));

  return server;
}