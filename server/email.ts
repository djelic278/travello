import nodemailer from 'nodemailer';

// Create a test SMTP service with Ethereal Email
let testAccount: any = null;

async function getTestAccount() {
  try {
    if (!testAccount) {
      testAccount = await nodemailer.createTestAccount();
    }
    return testAccount;
  } catch (error) {
    console.error('Error creating test account:', error);
    throw new Error('Failed to create test email account');
  }
}

export async function sendInvitationEmail(email: string, token: string) {
  try {
    // Get test account with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let account;

    while (retryCount < maxRetries) {
      try {
        account = await getTestAccount();
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }

    if (!account) {
      throw new Error('Could not create test email account after multiple attempts');
    }

    // Create transporter with test credentials
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass
      },
    });

    // Create the invitation URL
    const invitationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/register?token=${token}`;

    const mailOptions = {
      from: '"Travel Expense System" <noreply@travelexpense.com>',
      to: email,
      subject: 'Invitation to Join as Company Admin',
      html: `
        <h1>Welcome to Travel Expense System</h1>
        <p>You have been invited to join as a Company Administrator.</p>
        <p>Click the link below to complete your registration:</p>
        <a href="${invitationUrl}">${invitationUrl}</a>
        <p>This invitation link will expire in 7 days.</p>
        <p>If you did not request this invitation, please ignore this email.</p>
      `
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Get the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Email sent successfully');
    console.log('Preview URL:', previewUrl);
    console.log('Message ID:', info.messageId);

    return { 
      success: true, 
      previewUrl,
      messageId: info.messageId,
      testCredentials: {
        email: account.user,
        password: account.pass,
        etherealUrl: 'https://ethereal.email'
      }
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred while sending email'
    };
  }
}