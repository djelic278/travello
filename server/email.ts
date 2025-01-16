import nodemailer from 'nodemailer';

// Create a test SMTP service
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: 'test@ethereal.email', // Will be replaced with actual credentials
    pass: 'test123'              // Will be replaced with actual credentials
  },
});

export async function sendInvitationEmail(email: string, token: string) {
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

  try {
    // For development, we'll use Ethereal Email (fake SMTP service)
    const testAccount = await nodemailer.createTestAccount();
    
    // Update transporter with test credentials
    transporter.auth = {
      user: testAccount.user,
      pass: testAccount.pass
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Log the test URL where the email can be viewed
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    
    return { success: true, previewUrl: nodemailer.getTestMessageUrl(info) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
