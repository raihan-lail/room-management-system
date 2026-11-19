import { escapeHtml, formatEmailDate } from "./helpers.js";
import type { EmailContent } from "./types.js";

interface CheckOutGoodbyeEmailInput {
  residentName: string;
  bookingNumber: string;
  siteName: string;
  locationName: string;
  roomName: string;
  bedName: string;
  startedAt: Date;
  endedAt: Date;
  checkedInAt: Date | null;
  checkedOutAt: Date;
  ratingUrl?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function calculateTotalDays(
  checkedInAt: Date | null,
  startedAt: Date,
  checkedOutAt: Date
): number {
  const stayStart = checkedInAt ?? startedAt;

  return Math.max(
    1,
    Math.ceil((checkedOutAt.getTime() - stayStart.getTime()) / DAY_MS)
  );
}

export function buildCheckOutGoodbyeEmail(
  input: CheckOutGoodbyeEmailInput
): EmailContent {
  const residentName = escapeHtml(input.residentName);
  const bookingNumber = escapeHtml(input.bookingNumber);
  const siteName = escapeHtml(input.siteName);
  const locationName = escapeHtml(input.locationName);
  const roomName = escapeHtml(input.roomName);
  const bedName = escapeHtml(input.bedName);

  const startedAt = formatEmailDate(input.startedAt);
  const endedAt = formatEmailDate(input.endedAt);
  const checkedOutAt = formatEmailDate(input.checkedOutAt);
  const totalDays = calculateTotalDays(
    input.checkedInAt,
    input.startedAt,
    input.checkedOutAt
  );

  const details: Array<[string, string]> = [
    ["Booking ID", bookingNumber],
    ["Site", siteName],
    ["Location", locationName],
    ["Room", roomName],
    ["Bed", bedName],
    ["Booked period", `${startedAt} - ${endedAt}`],
    ["Check-out date", checkedOutAt],
    ["Total days", String(totalDays)],
    ["Status", "Checked out"],
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

  const ratingSection = input.ratingUrl
    ? `
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Rate Your Stay</p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#1a1f2e;">
                  Tell us how your stay went. This link can be used once.
                </p>
                <a href="${escapeHtml(input.ratingUrl)}" style="display:inline-block;padding:11px 18px;background-color:#273896;border-radius:6px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Rate your stay</a>
              </td>
            </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Goodbye</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#273896;padding:22px 32px;">
                <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9d0f0;">Camp Management System</div>
                <div style="margin-top:4px;font-size:20px;font-weight:700;color:#ffffff;">Thank You for Staying With Us</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#1a1f2e;">Dear ${residentName},</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5a6275;">
                  Thank you for staying with us at ${siteName}. Your check-out is complete, and we hope your stay was comfortable. Please review your stay summary below and keep this email for your records.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a6275;">Stay Summary</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${detailRows}
                </table>
              </td>
            </tr>

            ${ratingSection}

            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f8fb;border:1px solid #dfe3ea;border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#5a6275;">
                      We wish you a safe journey. If you need any assistance or have feedback about your stay, please contact the reception or site staff.
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
    `Thank you for staying with us at ${input.siteName}. Your check-out is complete, and we hope your stay was comfortable.`,
    "",
    "Stay Summary",
    `Booking ID: ${input.bookingNumber}`,
    `Site: ${input.siteName}`,
    `Location: ${input.locationName}`,
    `Room: ${input.roomName}`,
    `Bed: ${input.bedName}`,
    `Booked period: ${startedAt} - ${endedAt}`,
    `Check-out date: ${checkedOutAt}`,
    `Total days: ${totalDays}`,
    "Status: Checked out",
    "",
    ...(input.ratingUrl
      ? ["To rate your stay, open this link (single use):", input.ratingUrl, ""]
      : []),
    "We wish you a safe journey. If you need any assistance or have feedback about your stay, please contact the reception or site staff.",
    "",
    "This is an automated message from the Camp Management System. Please do not reply to this email.",
  ];

  return {
    subject: `Resident Checked Out - ${input.siteName} - Booking ${input.bookingNumber}`,
    html,
    text: textLines.join("\n"),
  };
}
