import { transporter } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import { isEmailEnabled } from "./setting.service.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;

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

interface BookingCreatedEmailInput {
  residentName: string;
  bookingNumber: string;
  roomName: string;
  bedName: string;
  startedAt: Date;
  endedAt: Date;
  notes?: string | null;
  loginEmail: string;
 
}

const EMAIL_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatEmailDate(date: Date): string {
  return EMAIL_DATE_FORMATTER.format(date);
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function buildBookingCreatedEmail(input: BookingCreatedEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const residentName = escapeHtml(input.residentName);
  const bookingNumber = escapeHtml(input.bookingNumber);
  const roomName = escapeHtml(input.roomName);
  const bedName = escapeHtml(input.bedName);
  const loginEmail = escapeHtml(input.loginEmail);
  const notes = input.notes ? escapeHtml(input.notes) : "";

  const startedAt = formatEmailDate(input.startedAt);
  const endedAt = formatEmailDate(input.endedAt);

  const details: Array<[string, string]> = [
    ["Booking ID", bookingNumber],
    ["Room", roomName],
    ["Bed", bedName],
    ["Check-in date", startedAt],
    ["Check-out date", endedAt],
    ["Status", "Confirmed"],
  ];

  const detailRows = details
    .map(
      ([label, value]) => `
                    <tr>
                      <td style="padding:11px 0;border-bottom:1px solid #e6e8ee;font-size:13px;color:#5a6275;width:45%;">${label}</td>
                      <td style="padding:11px 0;border-bottom:1px solid #e6e8ee;font-size:13px;color:#1a1f2e;font-weight:600;text-align:right;">${value}</td>
                    </tr>`,
    )
    .join("");

  const notesBlock = notes
    ? `
                  <tr>
                    <td style="padding:16px 32px 0;">
                      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Notes</p>
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#1a1f2e;">${notes}</p>
                    </td>
                  </tr>`
    : "";

  

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Booking Confirmation</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#273896;padding:22px 32px;">
                <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9d0f0;">Camp Management System</div>
                <div style="margin-top:4px;font-size:20px;font-weight:700;color:#ffffff;">Booking Confirmation</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#1a1f2e;">Dear ${residentName},</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5a6275;">
                  Your booking has been confirmed. Please review the details below and keep this email for your records.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Booking Details</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${detailRows}
                </table>
              </td>
            </tr>
${notesBlock}
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f8fb;border:1px solid #dfe3ea;border-radius:6px;">
                  <tr>
                   
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 28px;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#8a90a2;">
                  This is an automated message from the Camp Management System. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    `Dear ${input.residentName},`,
    "",
    "Your booking has been confirmed.",
    "",
    "Booking Details",
    `Booking ID: ${input.bookingNumber}`,
    `Room: ${input.roomName}`,
    `Bed: ${input.bedName}`,
    `Check-in date: ${startedAt}`,
    `Check-out date: ${endedAt}`,
    "Status: Confirmed",
    ...(input.notes ? ["", `Notes: ${input.notes}`] : []),
    "",
   
    
    "",
    "This is an automated message from the Camp Management System. Please do not reply to this email.",
  ];

  return {
    subject: `Booking ${input.bookingNumber} confirmed`,
    html,
    text: textLines.join("\n"),
  };
}
