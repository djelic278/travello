import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { users, travelForms, expenses, settings, notifications, companies, invitations } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import multer from "multer";
import { processReceipt } from "./services/ocr";
import OpenAI from "openai";
import { z } from "zod";

// Update User interface to match our schema
interface User {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'company_admin' | 'user';
  companyId?: number;
  createdAt: string;
  updatedAt: string;
}

// Extend Express Request type to include our User type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Initialize OpenAI with the new API key name
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY1 });

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Not logged in");
  }
  next();
};

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Voice processing route schema
const voiceInputSchema = z.object({
  transcript: z.string(),
});

export function registerRoutes(app: Express): Server {
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
    console.log('Role update request:', { userId: req.params.id, newRole: req.body.role, requestingUser: req.user?.role });

    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      console.log('Permission denied: User is not super admin');
      return res.status(403).json({ message: "Only super admins can update user roles" });
    }

    const userId = parseInt(req.params.id);
    const { role } = req.body;

    // Validate role
    if (!['super_admin', 'company_admin', 'user'].includes(role)) {
      console.log('Invalid role specified:', role);
      return res.status(400).json({ message: "Invalid role specified" });
    }

    // Prevent super admin from modifying their own role
    if (userId === req.user.id) {
      console.log('Attempted to modify own role');
      return res.status(403).json({ message: "Cannot modify your own role" });
    }

    try {
      // First check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!existingUser) {
        console.log('User not found:', userId);
        return res.status(404).json({ message: "User not found" });
      }

      // Update user role
      const [updatedUser] = await db
        .update(users)
        .set({
          role: role as 'super_admin' | 'company_admin' | 'user',
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      console.log('Role updated successfully:', { userId, newRole: role });
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ 
        message: "Failed to update user role",
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

  // Update user organization (super admin only)
  app.put("/api/users/:id", isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
    // Check if user is super admin
    if (req.user?.role !== 'super_admin') {
      return res.status(403).send("Only super admins can update user organizations");
    }

    const userId = parseInt(req.params.id);
    const { companyId } = req.body;

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        companyId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).send("User not found");
    }

    res.json(updatedUser);
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

  // Voice processing route with improved error handling
  app.post('/api/voice-process', async (req: Request, res: Response) => {
    try {
      const result = voiceInputSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input: transcript is required' });
      }

      const { transcript } = result.data;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that extracts travel form information from voice input.
            Extract any relevant fields from this list if mentioned:
            - submissionLocation (string, the current location)
            - firstName (string)
            - lastName (string)
            - destination (string, the travel destination)
            - tripPurpose (string)
            - transportType (string, e.g. "car", "train", "plane")
            - transportDetails (string, additional transport information)
            - startDate (full datetime in ISO format)
            - duration (number, in days)
            - projectCode (string)
            - requestedPrepayment (number, amount in EUR)
            - startMileage (number)
            - endMileage (number)
            - departureTime (full datetime in ISO format)
            - returnTime (full datetime in ISO format)
            - purpose (string, for expenses)
            - amount (number, for expenses)

            Format the response as JSON. For dates and times:
            - If only a date is mentioned, use 09:00:00 as the default time
            - If only a time is mentioned, use today's date
            - Convert all dates and times to ISO format with timezone
            - For duration, extract the number of days

            For monetary values:
            - Extract only numeric portions
            - Convert to numbers
            - Assume EUR currency if not specified`
          },
          {
            role: "user",
            content: transcript
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsedResult = JSON.parse(content);

      // Process numeric fields
      const processedResult = {
        ...parsedResult,
        requestedPrepayment: parsedResult.requestedPrepayment ?
          parseFloat(String(parsedResult.requestedPrepayment).replace(/[^0-9.]/g, '')) : undefined,
        duration: parsedResult.duration ?
          parseInt(String(parsedResult.duration).replace(/[^0-9]/g, '')) : undefined,
        startMileage: parsedResult.startMileage ?
          parseFloat(String(parsedResult.startMileage).replace(/[^0-9.]/g, '')) : undefined,
        endMileage: parsedResult.endMileage ?
          parseFloat(String(parsedResult.endMileage).replace(/[^0-9.]/g, '')) : undefined,
        amount: parsedResult.amount ?
          parseFloat(String(parsedResult.amount).replace(/[^0-9.]/g, '')) : undefined,
      };

      // Process dates
      if (parsedResult.startDate) {
        processedResult.startDate = new Date(parsedResult.startDate).toISOString();
      }
      if (parsedResult.departureTime) {
        processedResult.departureTime = new Date(parsedResult.departureTime).toISOString();
      }
      if (parsedResult.returnTime) {
        processedResult.returnTime = new Date(parsedResult.returnTime).toISOString();
      }

      res.json(processedResult);
    } catch (error) {
      console.error('Error processing voice input:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to process voice input'
      });
    }
  });

  // Initialize settings
  initializeSettings().catch(console.error);

  const httpServer = createServer(app);
  const { sendNotification } = setupWebSocket(httpServer, app);
  app.set('sendNotification', sendNotification);

  return httpServer;
}

// Wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

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


import * as xlsx from 'xlsx';
import { randomBytes } from "crypto";
import { sendInvitationEmail } from './email';
import { updateUserProfileSchema, sendInvitationSchema } from "@db/schema";