import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, travelForms, expenses, settings, notifications, companies, invitations, UserRole } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import { processReceipt } from "./services/ocr";
import vehicleRoutes from './routes/vehicles';
import { isAuthenticated } from './middleware/auth';
import { upload } from './middleware/upload';
import { asyncHandler } from './utils/asyncHandler';
import * as xlsx from 'xlsx';
import { randomBytes } from "crypto";
import { sendInvitationEmail } from './email';
import { updateUserProfileSchema, sendInvitationSchema } from "@db/schema";

export function registerRoutes(app: Express): Server {
  // Test endpoint to verify registration form fields
  app.get("/api/test/registration-fields", (req, res) => {
    res.json({
      message: "Registration form fields verification",
      fieldsExpected: ["username", "password", "email", "firstName", "lastName"],
      registrationSchema: "See server/auth.ts for the complete schema"
    });
  });

  // Add vehicle routes
  app.use('', vehicleRoutes);

  // Get current user data
  app.get("/api/user", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).send("User not authenticated");
    }
    
    // Return the user without the password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  }));

  // Get all users (super admin only)
  app.get("/api/users", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can view all users");
    }

    const usersList = await db.query.users.findMany({
      orderBy: (users, { asc }) => [asc(users.username)]
    });

    res.json(usersList);
  }));

  // Export users to Excel (super admin only)
  app.get("/api/users/export", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can export users");
    }

    // Fetch all users
    const usersList = await db.query.users.findMany({
      orderBy: (users, { asc }) => [asc(users.username)]
    });

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(usersList.map(user => ({
      Username: user.username,
      Email: user.email,
      'First Name': user.firstName || '',
      'Last Name': user.lastName || '',
      Organization: user.organization || '',
      'Created At': new Date(user.createdAt).toLocaleString(),
      Role: user.role || 'user'
    })));

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Users');

    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=users-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buf);
  }));

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

    // Ensure valid date objects before updating
    const parsedDepartureTime = new Date(departureTime);
    const parsedReturnTime = new Date(returnTime);

    // Validate dates
    if (isNaN(parsedDepartureTime.getTime()) || isNaN(parsedReturnTime.getTime())) {
      return res.status(400).json({ message: "Invalid date format for departure or return time" });
    }

    // Update the travel form with validated dates
    const [updatedForm] = await db
      .update(travelForms)
      .set({
        departureTime: parsedDepartureTime,
        returnTime: parsedReturnTime,
        startMileage: parseFloat(startMileage),
        endMileage: parseFloat(endMileage),
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
          amount: parseFloat(expense.amount),
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

  // Get single travel form by ID
  app.get("/api/forms/:id", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const formId = parseInt(req.params.id);

    const form = await db.query.travelForms.findFirst({
      where: and(
        eq(travelForms.id, formId),
        // Ensure user can only access their own forms
        eq(travelForms.userId, req.user!.id)
      ),
      with: {
        expenses: true,
      }
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.json({
      id: form.id,
      firstName: form.firstName,
      lastName: form.lastName,
      destination: form.destination,
      projectCode: form.projectCode,
      requestedPrepayment: form.requestedPrepayment,
      startDate: form.startDate,
      tripPurpose: form.tripPurpose,
      transportType: form.transportType,
      transportDetails: form.transportDetails,
      status: form.status,
      expenses: form.expenses,
    });
  }));

  // Approve travel form
  app.put("/api/forms/:id/approve", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const formId = parseInt(req.params.id);
    const { approved } = req.body;

    // Check if user is authorized to approve forms
    if (req.user?.role !== 'super_admin' && req.user?.role !== 'company_admin') {
      return res.status(403).send("Only administrators can approve travel requests");
    }

    // Get the form
    const form = await db.query.travelForms.findFirst({
      where: and(
        eq(travelForms.id, formId),
        // Company admins can only approve forms from their company
        req.user.role === 'company_admin'
          ? eq(travelForms.companyId, req.user.companyId!)
          : undefined
      )
    });

    if (!form) {
      return res.status(404).send("Form not found");
    }

    // Update approval status
    const [updatedForm] = await db
      .update(travelForms)
      .set({
        approvalStatus: approved ? 'approved' : 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(travelForms.id, formId))
      .returning();

    // Create notification for the form owner
    const notification = await createNotification(
      form.userId,
      approved ? 'Travel Request Approved' : 'Travel Request Rejected',
      `Your travel request to ${form.destination} has been ${approved ? 'approved' : 'rejected'}`,
      'form_submitted',
      { formId: form.id }
    );

    // Send real-time notification
    if (req.app.get('sendNotification')) {
      const sendNotification = req.app.get('sendNotification');
      sendNotification(form.userId, notification);
    }

    res.json(updatedForm);
  }));


  // Get all users (super admin only)
  app.get("/api/admin/users", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can view all users");
    }

    const usersList = await db.query.users.findMany({
      orderBy: (users, { asc }) => [asc(users.username)]
    });

    res.json(usersList);
  }));

  // Update user role (super admin only)
  app.put("/api/admin/users/:id/role", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    console.log('Role update request received - User:', req.user);
    console.log('Role update parameters:', { userId: req.params.id, newRole: req.body.role });

    if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
      console.log('Permission denied: User is not super admin');
      return res.status(403).json({ message: "Only super admins can update user roles" });
    }

    const userId = parseInt(req.params.id);
    const { role } = req.body;

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      console.log('Invalid role specified:', role);
      return res.status(400).json({ message: "Invalid role specified" });
    }

    // Prevent super admin from modifying their own role
    if (userId === req.user.id) {
      console.log('Attempted to modify own role');
      return res.status(403).json({ message: "Cannot modify your own role" });
    }

    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          role: role as typeof UserRole[keyof typeof UserRole],
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        console.log('User not found:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('Role updated successfully:', updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({
        message: "Failed to update user role",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }));

  // Update user's company (super admin only)
  app.put("/api/users/:id", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    console.log('Company update request received - User:', req.user);
    console.log('Company update parameters:', { userId: req.params.id, companyId: req.body.companyId });

    if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
      console.log('Permission denied: User is not super admin');
      return res.status(403).json({ message: "Only super admins can update user organizations" });
    }

    const userId = parseInt(req.params.id);
    const { companyId } = req.body;

    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          companyId: companyId || null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        console.log('User not found:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('Company updated successfully:', updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user company:', error);
      res.status(500).json({
        message: "Failed to update user company",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }));

  // Get notifications for the current user
  app.get("/api/notifications", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const notificationList = await db.query.notifications.findMany({
      where: eq(notifications.userId, req.user!.id),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)]
    });
    res.json(notificationList);
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
    const companiesList = await db.query.companies.findMany({
      orderBy: (companies, { asc }) => [asc(companies.name)]
    });
    res.json(companiesList);
  }));

  // Add new company
  app.post("/api/companies", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    const { name, address, vatNumber, contactEmail, adminEmail } = req.body;

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
        vatNumber,
        contactEmail,
        adminEmail,
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

      // Allow both super admins and company admins to change company assignments
      if (companyId !== undefined && req.user?.role !== 'super_admin' && req.user?.role !== 'company_admin') {
        return res.status(403).send("Only admins can change company assignments");
      }

      // Update user profile with validation
      const [updatedUser] = await db
        .update(users)
        .set({
          ...otherData,
          ...(req.user?.role === 'super_admin' || req.user?.role === 'company_admin' ? { companyId } : {}),
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

    try {
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
        return res.status(400).json({
          success: false,
          error: "An invitation is already pending for this email"
        });
      }

      // Generate a unique token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

      // Create the invitation first
      const [invitation] = await db.insert(invitations).values({
        email,
        type,
        token,
        expiresAt,
        status: 'pending'
      }).returning();

      // Send invitation email
      const emailResult = await sendInvitationEmail(email, token);

      if (!emailResult.success) {
        // Update invitation status to failed
        await db.update(invitations)
          .set({ status: 'failed' as const })
          .where(eq(invitations.id, invitation.id));

        return res.status(200).json({
          success: false,
          message: "Invitation created but email delivery failed",
          error: emailResult.error,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            type: invitation.type,
            status: 'failed',
            expiresAt: invitation.expiresAt,
          }
        });
      }

      // Email sent successfully
      return res.json({
        success: true,
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          type: invitation.type,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        emailPreviewUrl: emailResult.previewUrl,
        testEnvironment: {
          note: "This is a test environment. Emails are not actually delivered but can be viewed at Ethereal Email.",
          credentials: emailResult.testCredentials
        }
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    }
  }));

  // Get all invitations (super admin only)
  app.get("/api/invitations", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can view invitations");
    }

    const invitationsList = await db.query.invitations.findMany({
      orderBy: (invitations, { desc }) => [desc(invitations.createdAt)]
    });

    res.json(invitationsList);
  }));

  // Delete invitation (super admin only)
  app.delete("/api/invitations/:id", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can delete invitations");
    }

    const [deletedInvitation] = await db
      .delete(invitations)
      .where(eq(invitations.id, parseInt(req.params.id)))
      .returning();

    if (!deletedInvitation) {
      return res.status(404).send("Invitation not found");
    }

    res.json({ message: "Invitation deleted successfully" });
  }));

  // Resend invitation (super admin only)
  app.post("/api/invitations/:id/resend", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can resend invitations");
    }

    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, parseInt(req.params.id)));

    if (!invitation) {
      return res.status(404).send("Invitation not found");
    }

    // Generate a new token and update expiration
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    const [updatedInvitation] = await db
      .update(invitations)
      .set({
        token,
        expiresAt,
        status: 'pending',
      })
      .where(eq(invitations.id, invitation.id))
      .returning();

    // Send the new invitation email
    const emailResult = await sendInvitationEmail(invitation.email, token);

    if (!emailResult.success) {
      return res.json({
        message: "Invitation updated but email delivery failed. Please check logs.",
        invitation: updatedInvitation,
        emailPreviewUrl: emailResult.previewUrl
      });
    }

    res.json({
      message: "Invitation resent successfully",
      invitation: updatedInvitation,
      emailPreviewUrl: emailResult.previewUrl
    });
  }));


  // Add new OCR endpoint
  app.post("/api/ocr/receipt", isAuthenticated, upload.single('receipt'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const result = await processReceipt(req.file.buffer);
      res.json(result);
    } catch (error) {
      console.error('Error in OCR processing:', error);
      res.status(500).json({ message: error.message || 'Failed to process receipt' });
    }
  }));

  // Initialize settings
  initializeSettings().catch(console.error);

  const httpServer = createServer(app);
  const { sendNotification } = setupWebSocket(httpServer, app);
  app.set('sendNotification', sendNotification);

  return httpServer;
}

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
async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: 'form_submitted' | 'form_completed' | 'other',
  metadata?: any
) {
  const [notification] = await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    metadata: metadata ? JSON.stringify(metadata) : null,
  }).returning();

  return notification;
}

import type { Request, Response, NextFunction } from "express";