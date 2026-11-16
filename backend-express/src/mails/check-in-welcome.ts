import path from "node:path";
import { escapeHtml, formatEmailDate } from "./helpers.js";
import type { EmailAttachment, EmailContent } from "./types.js";

interface CheckInWelcomeEmailInput {
  residentName: string;
  bookingNumber: string;
  siteName: string;
  locationName: string;
  roomName: string;
  bedName: string;
  checkedInAt: Date;
}

export const CHECK_IN_EMAIL_ATTACHMENTS: EmailAttachment[] = [
  {
    filename: "Welcome Book.pdf",
    path: path.resolve(
      process.cwd(),
      "public/attachment/THIS IS WELCOMING BOOK.pdf"
    ),
  },
  {
    filename: "Guide Example.pdf",
    path: path.resolve(
      process.cwd(),
      "public/attachment/THIS IS GUIDE EXAMPLE.pdf"
    ),
  },
];

export function buildCheckInWelcomeEmail(
  input: CheckInWelcomeEmailInput
): EmailContent {
  const residentName = escapeHtml(input.residentName);
  const bookingNumber = escapeHtml(input.bookingNumber);
  const siteName = escapeHtml(input.siteName);
  const locationName = escapeHtml(input.locationName);
  const roomName = escapeHtml(input.roomName);
  const bedName = escapeHtml(input.bedName);

  const checkedInAt = formatEmailDate(input.checkedInAt);

  const details: Array<[string, string]> = [
    ["Booking ID", bookingNumber],
    ["Site", siteName],
    ["Location", locationName],
    ["Room", roomName],
    ["Bed", bedName],
    ["Check-in date", checkedInAt],
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

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#273896;padding:22px 32px;">
                <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9d0f0;">Camp Management System</div>
                <div style="margin-top:4px;font-size:20px;font-weight:700;color:#ffffff;">Welcome to ${siteName}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#1a1f2e;">Dear ${residentName},</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5a6275;">
                  Welcome! We are glad to have you with us. Your check-in is complete, and your room is ready. Please review your stay details below and keep this email for your records.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Stay Details</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${detailRows}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 0;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Attached</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#1a1f2e;">
                  We have attached a welcome book and a guide to help you settle in. Please take a moment to read through them.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f8fb;border:1px solid #dfe3ea;border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#5a6275;">
                      If you need any assistance during your stay, please contact the reception or site staff.
                    </td>
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
    "Welcome! We are glad to have you with us. Your check-in is complete, and your room is ready.",
    "",
    "Stay Details",
    `Booking ID: ${input.bookingNumber}`,
    `Site: ${input.siteName}`,
    `Location: ${input.locationName}`,
    `Room: ${input.roomName}`,
    `Bed: ${input.bedName}`,
    `Check-in date: ${checkedInAt}`,
    "",
    "We have attached a welcome book and a guide to help you settle in.",
    "",
    "If you need any assistance during your stay, please contact the reception or site staff.",
    "",
    "This is an automated message from the Camp Management System. Please do not reply to this email.",
  ];

  return {
    subject: `Welcome to ${input.siteName} - Booking ${input.bookingNumber}`,
    html,
    text: textLines.join("\n"),
  };
}
