import nodemailer, { TestAccount, Transporter } from 'nodemailer';

// Store test account globally for reuse
let testAccount: TestAccount | null = null;
let transporter: Transporter | null = null;

interface EmailResult {
  success: boolean;
  previewUrl?: string;
  messageId?: string;
  testCredentials?: {
    email: string;
    password: string;
    etherealUrl: string;
  };
  error?: string;
}

async function createTestAccount(): Promise<TestAccount> {
  try {
    if (!testAccount) {
      console.log('Creating new test account...');
      testAccount = await nodemailer.createTestAccount();
      console.log('Test account created successfully');
    }
    return testAccount;
  } catch (error) {
    console.error('Error creating test account:', error);
    throw new Error(
      'Failed to create test email account. Check the email service configuration.',
    );
  }
}

async function getTransporter(): Promise<Transporter> {
  try {
    if (!transporter) {
      const account = await createTestAccount();
      console.log('Creating new transporter with account:', account.user);
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass
        },
        debug: true, // Enable debug logs
        logger: true  // Log to console
      });

      // Verify transporter
      await transporter.verify();
      console.log('Transporter verified successfully');
    }
    return transporter;
  } catch (error) {
    console.error('Error creating/verifying transporter:', error);
    throw new Error('Failed to create email transporter. Please check SMTP configuration.');
  }
}

export async function sendInvitationEmail(email: string, token: string): Promise<EmailResult> {
  try {
    console.log('Starting email send process to:', email);

    // Get or create transporter with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let currentTransporter: Transporter | null = null;

    while (retryCount < maxRetries) {
      try {
        currentTransporter = await getTransporter();
        break;
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error('Failed to create email transporter after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }

    if (!currentTransporter || !testAccount) {
      throw new Error('Email service is not properly initialized');
    }

    // Create the invitation URL
    const invitationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/register?token=${token}`;
    console.log('Generated invitation URL:', invitationUrl);

    // Enhanced email template with better styling
    const mailOptions = {
      from: '"Travel Expense System" <noreply@travelexpense.com>',
      to: email,
      subject: 'Invitation to Join as Company Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Welcome to Travel Expense System</h1>
          <div style="background-color: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <p style="color: #666;">You have been invited to join as a Company Administrator.</p>
            <p style="color: #666;">To complete your registration, please click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" 
                 style="background-color: #0070f3; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Complete Registration
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this URL into your browser:</p>
            <p style="color: #666; font-size: 14px; word-break: break-all;">${invitationUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This invitation link will expire in 7 days.<br>
              If you did not request this invitation, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    console.log('Attempting to send email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const info = await currentTransporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    console.log('Message ID:', info.messageId);

    return {
      success: true,
      previewUrl: nodemailer.getTestMessageUrl(info),
      messageId: info.messageId,
      testCredentials: {
        email: testAccount.user,
        password: testAccount.pass,
        etherealUrl: 'https://ethereal.email'
      }
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error 
        ? `Email delivery failed: ${error.message}`
        : 'Unknown error occurred while sending email'
    };
  }
}