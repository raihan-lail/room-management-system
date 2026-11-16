import { transporter } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import type { EmailAttachment } from "../mails/types.js";
import { isEmailEnabled } from "./setting.service.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];

  type: string;
  userId?: string;
  bookingId?: string;
  siteId?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  type,
  userId,
  bookingId,
  siteId,
}: SendEmailOptions) {
  if (!(await isEmailEnabled())) {
    return {
      success: false,
      skipped: true,
      error: "Email sending is disabled.",
    };
  }

  const emailLog = await prisma.emailLog.create({
    data: {
      recipient: to,
      subject,
      type,
      userId,
      bookingId,
      siteId,
      status: "PENDING",
    },
  });

  try {
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
      attachments,
    });

    if (
      result.accepted.length === 0 ||
      result.rejected.length > 0
    ) {
      throw new Error(
        `SMTP rejected recipient: ${result.rejected.join(", ")}`
      );
    }

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "SENT",
        messageId: result.messageId,
        sentAt: new Date(),
        attempts: 1,
      },
    });

    return {
      success: true,
      emailLogId: emailLog.id,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown email sending error";

    // Update failed attempt
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "FAILED",
        error: errorMessage.slice(0, 2000),
        attempts: 1,
      },
    });

    console.error("Email sending failed:", {
      emailLogId: emailLog.id,
      recipient: to,
      subject,
      error: errorMessage,
    });

    return {
      success: false,
      emailLogId: emailLog.id,
      error: errorMessage,
    };
  }
}
