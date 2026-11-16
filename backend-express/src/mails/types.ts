export interface EmailAttachment {
  filename: string;
  path: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}
