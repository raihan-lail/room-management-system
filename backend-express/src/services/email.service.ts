import { transporter } from "../lib/mailer.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions) {
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName =
    process.env.SMTP_FROM_NAME || "Dorm Management System";

  if (!fromEmail) {
    throw new Error("SMTP_FROM_EMAIL is not configured.");
  }

  const result = await transporter.sendMail({
    from: {
      name: fromName,
      address: fromEmail,
    },
    to,
    subject,
    html,
    text,
  });

  return result;
}