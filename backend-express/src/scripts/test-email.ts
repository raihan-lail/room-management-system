import "dotenv/config";
import { verifyMailer } from "../lib/mailer.js";
import { sendEmail } from "../services/email.service.js";

async function main() {
  await verifyMailer();

  const result = await sendEmail({
    to: "enter-your-email@gmail.com",
    subject: "SMTP Test",
    html: `
      <h2>Hello!</h2>
      <p>This is a test email from the Dorm Management System.</p>
    `,
    text: "This is a test email from the Dorm Management System.",
  });

  console.log("Email sent:", result.messageId);
}

main().catch(console.error);