import nodemailer from "nodemailer";

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  throw new Error("Missing Gmail SMTP credentials.");
}

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user,
    pass,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
});

export async function verifyMailer() {
  try {
    await transporter.verify();
    console.log("Gmail SMTP connection established successfully.");
  } catch (error) {
    console.error("Gmail SMTP connection failed:", error);
    throw error;
  }
}