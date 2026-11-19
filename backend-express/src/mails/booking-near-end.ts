import { escapeHtml, formatEmailDate } from "./helpers.js";
import type { EmailContent } from "./types.js";

interface BookingNearEndEmailInput {
  residentName: string;
  bookingNumber: string;
  siteName: string;
  locationName: string;
  roomName: string;
  bedName: string;
  endedAt: Date;
}

export function buildBookingNearEndEmail(
  input: BookingNearEndEmailInput
): EmailContent {
  const residentName = escapeHtml(input.residentName);
  const bookingNumber = escapeHtml(input.bookingNumber);
  const siteName = escapeHtml(input.siteName);
  const locationName = escapeHtml(input.locationName);
  const roomName = escapeHtml(input.roomName);
  const bedName = escapeHtml(input.bedName);

  const endedAt = formatEmailDate(input.endedAt);

  const details: Array<[string, string]> = [
    ["Booking ID", bookingNumber],
    ["Site", siteName],
    ["Location", locationName],
    ["Room", roomName],
    ["Bed", bedName],
    ["End date", endedAt],
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
    <title>Booking Ending Soon</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe3ea;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#273896;padding:22px 32px;">
                <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9d0f0;">Camp Management System</div>
                <div style="margin-top:4px;font-size:20px;font-weight:700;color:#ffffff;">Booking Ending Soon</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#1a1f2e;">Dear ${residentName},</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5a6275;">
                  Your booking is almost ending on ${endedAt}. Please contact the receptionist if you want to extend your stay.
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

            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f8fb;border:1px solid #dfe3ea;border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#5a6275;">
                      If you need any assistance, please contact the reception or site staff before your booking ends.
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
    `Your booking is almost ending on ${endedAt}. Please contact the receptionist if you want to extend your stay.`,
    "",
    "Booking Details",
    `Booking ID: ${input.bookingNumber}`,
    `Site: ${input.siteName}`,
    `Location: ${input.locationName}`,
    `Room: ${input.roomName}`,
    `Bed: ${input.bedName}`,
    `End date: ${endedAt}`,
    "",
    "If you need any assistance, please contact the reception or site staff before your booking ends.",
    "",
    "This is an automated message from the Camp Management System. Please do not reply to this email.",
  ];

  return {
    subject: `Booking ${input.bookingNumber} is ending soon`,
    html,
    text: textLines.join("\n"),
  };
}
