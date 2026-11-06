/**
 * Server-only Email Dispatch Service
 * Sends official 6-digit verification codes and magic links to student university Gmail accounts (@cuiatk.edu.pk).
 */
import nodemailer from "nodemailer";

interface SendVerificationEmailOptions {
  toEmail: string;
  studentName: string;
  verificationCode: string;
  magicLink?: string;
}

const DEFAULT_SMTP_USER = process.env.SMTP_USER || "cuiattockcampus@gmail.com";
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || "";

/**
 * Creates nodemailer transport based on environment configuration.
 * Defaults to Gmail SMTP (smtp.gmail.com:465) using SSL with the dedicated campus account.
 */
function getEmailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const rawUser = process.env.SMTP_USER || DEFAULT_SMTP_USER;
  const rawPass = process.env.SMTP_PASS || DEFAULT_SMTP_PASS;

  const user = rawUser?.trim();
  const pass = rawPass?.replace(/\s+/g, "").trim();

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Dispatches an official CUI Attock email verification message
 */
export async function sendStudentVerificationEmail({
  toEmail,
  studentName,
  verificationCode,
  magicLink,
}: SendVerificationEmailOptions): Promise<{ sent: boolean; devMode?: boolean; error?: string }> {
  const transporter = getEmailTransporter();
  const senderEmail = process.env.SMTP_USER || DEFAULT_SMTP_USER;
  const fromAddress =
    process.env.SMTP_FROM || `"COMSATS Attock Timetable" <${senderEmail}>`;

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Verify Your Student Email</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 24px; color: #162d3b; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e1e8ed; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        .header { background: #087f79; padding: 24px 28px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
        .body { padding: 32px 28px; }
        .code-box { background: #f0fdfa; border: 2px dashed #087f79; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #087f79; font-family: monospace; }
        .btn { display: inline-block; background: #087f79; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 8px; margin-top: 16px; }
        .footer { padding: 18px 28px; background: #fafbfc; border-top: 1px solid #e1e8ed; text-align: center; font-size: 12px; color: #647480; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>COMSATS UNIVERSITY ISLAMABAD</h1>
          <p>Attock Campus • Student Workspace Verification</p>
        </div>
        <div class="body">
          <p style="font-size: 16px; margin: 0 0 16px;">Assalam-o-Alaikum <strong>${studentName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">
            We received a request to create a student account for <strong>${toEmail}</strong> on the official CUI Attock Timetable & Schedule Workspace.
          </p>
          
          <div class="code-box">
            <span style="font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; color: #087f79; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
            <div class="code">${verificationCode}</div>
            <span style="font-size: 12px; color: #647480; display: block; margin-top: 8px;">Valid for 10 minutes</span>
          </div>

          ${
            magicLink
              ? `
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 13px; color: #647480; margin-bottom: 12px;">Or simply click the button below to verify and complete your signup automatically:</p>
            <a href="${magicLink}" class="btn" target="_blank">Verify Email & Unlock App</a>
          </div>
          `
              : ""
          }

          <p style="font-size: 13px; line-height: 1.5; color: #647480; margin-top: 24px;">
            If you did not request this verification code, please ignore this email. No account will be created without this verification code.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0;">COMSATS University Islamabad, Attock Campus</p>
          <p style="margin: 4px 0 0;">Department of Computer Science • Automated Security System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    // If SMTP credentials are not yet set in environment, log to server console
    console.info(
      `\n[EMAIL VERIFICATION DISPATCH] (SMTP credentials not yet set in env)\n` +
        `To: ${toEmail}\n` +
        `Student: ${studentName}\n` +
        `Verification Code: ${verificationCode}\n` +
        (magicLink ? `Magic Link: ${magicLink}\n` : "") +
        `Note: To send actual emails via Gmail, set SMTP_USER and SMTP_PASS (Gmail App Password) in your Vercel or local environment.\n`,
    );

    return {
      sent: true,
      devMode: true,
    };
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `Your CUI Attock Verification Code: ${verificationCode}`,
      text: `Assalam-o-Alaikum ${studentName},\n\nYour CUI Attock Student Verification Code is: ${verificationCode}\n\nValid for 10 minutes.\n\nCOMSATS University Islamabad, Attock Campus`,
      html: htmlBody,
    });

    return { sent: true };
  } catch (err) {
    console.error("[student.email] Failed to send email via SMTP:", err);
    return {
      sent: false,
      error: "Failed to dispatch email. Please ensure your university email inbox is active.",
    };
  }
}
