import { supabase } from "./supabase";

export interface EmailCredentials {
  email: string;
  password: string;
  role: string;
}

export interface SendEmailOpts {
  loginUrl?: string;
  credentials?: EmailCredentials;
  showSecurityNote?: boolean;
}

export function brandedEmailLayout(bodyHtml: string): string {
  return `
    <div style="margin:0; padding:32px 16px; background:#12140a; font-family:Arial, sans-serif; color:#ffffff;">
      <div style="max-width:600px; margin:0 auto; background:rgba(200,255,0,0.03); border:1px solid rgba(255,255,255,0.10); border-radius:18px; overflow:hidden; box-shadow:0 12px 32px rgba(0, 0, 0, 0.28);">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderHeader(title: string, fullName: string): string {
  return `
    <div style="padding:32px; background:linear-gradient(135deg, #12140a 0%, #1f2610 100%); color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.10);">
      <p style="margin:0 0 10px; font-size:13px; letter-spacing:1.6px; text-transform:uppercase; color:#c8ff00;">Awareone</p>
      <h1 style="margin:0; font-size:28px; line-height:1.3;">${title}, ${fullName}</h1>
    </div>
  `;
}

function renderCredentials(credentials: EmailCredentials): string {
  return `
    <div style="margin:24px 0; padding:24px; background:rgba(200,255,0,0.10); border:1px solid rgba(200,255,0,0.20); border-radius:14px;">
      <p style="margin:0 0 12px; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#c8ff00;">
        Account Details
      </p>
      <p style="margin:0 0 10px; font-size:15px; color:#ffffff;"><strong>Email:</strong> ${credentials.email}</p>
      <p style="margin:0 0 10px; font-size:15px; color:#ffffff;"><strong>Password:</strong> ${credentials.password}</p>
      <p style="margin:0; font-size:15px; color:#ffffff;"><strong>Role:</strong> ${credentials.role}</p>
    </div>
  `;
}

function renderLoginButton(loginUrl: string): string {
  return `
    <div style="margin:24px 0;">
      <a
        href="${loginUrl}"
        style="display:inline-block; padding:14px 22px; background:#c8ff00; color:#12140a; text-decoration:none; font-size:15px; font-weight:700; border-radius:10px;"
      >
        Go to Login
      </a>
      <p style="margin:12px 0 0; font-size:14px; line-height:1.7; color:#94a3b8;">
        Website link: <a href="${loginUrl}" style="color:#c8ff00; text-decoration:none;">${loginUrl}</a>
      </p>
    </div>
  `;
}

function renderSecurityNote(): string {
  return `
    <div style="margin:24px 0; padding:18px 20px; background:rgba(255,255,255,0.03); border-left:4px solid #c8ff00; border-radius:10px;">
      <p style="margin:0; font-size:14px; line-height:1.7; color:#cbd5e1;">
        For security, please sign in and change your password as soon as possible.
      </p>
    </div>
    <p style="margin:24px 0 0; font-size:15px; line-height:1.8; color:#94a3b8;">
      If you need help getting started, reply to this email and our team will assist you.
    </p>
  `;
}

export async function sendNotificationEmail(
  to: string,
  fullName: string,
  subject: string,
  title: string,
  description: string,
  opts?: SendEmailOpts
): Promise<void> {
  const { loginUrl, credentials, showSecurityNote = false } = opts ?? {};

  const body = `
    ${renderHeader(title, fullName)}
    <div style="padding:32px;">
      <p style="margin:0 0 18px; font-size:15px; line-height:1.8; color:#94a3b8;">
        ${description}
      </p>
      ${credentials ? renderCredentials(credentials) : ""}
      ${loginUrl ? renderLoginButton(loginUrl) : ""}
      ${showSecurityNote ? renderSecurityNote() : ""}
    </div>
  `;

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to,
      subject,
      html: brandedEmailLayout(body),
    },
  });

  if (error) {
    throw error;
  }
}
