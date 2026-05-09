// ===========================================
// Email Service (Resend)
// ===========================================
// Triggered emails — password reset, payment success. The Resend client is
// lazy-initialized so dev environments without RESEND_API_KEY don't fail at
// import time; sendEmail() falls back to logging the payload to the console
// so flow can still be tested locally.

import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const log = logger.child({ module: "email" });

let resendClient: Resend | null = null;
function getClient(): Resend | null {
  if (resendClient) return resendClient;
  if (!env.email.resendApiKey) return null;
  resendClient = new Resend(env.email.resendApiKey);
  return resendClient;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via Resend. Returns whether it actually went out.
 * In dev (or when API key isn't set) just logs the payload instead of failing —
 * never let a missing API key break a user-facing flow.
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  const client = getClient();
  if (!client) {
    log.info(
      { to: args.to, subject: args.subject },
      "[DEV] Resend not configured — would have sent email (logging instead)",
    );
    log.debug({ html: args.html }, "[DEV] Email body");
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: env.email.mailFrom,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (error) {
      log.error({ to: args.to, subject: args.subject, err: error }, "Resend rejected email");
      return false;
    }
    log.info({ to: args.to, subject: args.subject }, "Email sent");
    return true;
  } catch (e) {
    log.error({ to: args.to, subject: args.subject, err: e }, "Resend threw");
    return false;
  }
}

// ===========================================
// Templates
// ===========================================

const APP_NAME = "CrawlComments";
const BASE_STYLE = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;`;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Đặt lại mật khẩu ${APP_NAME}`,
    html: `<div style="${BASE_STYLE}">
      <h2 style="color:#2563eb;margin:0 0 12px">Đặt lại mật khẩu</h2>
      <p>Có yêu cầu đặt lại mật khẩu cho tài khoản này. Nhấp vào nút bên dưới để đặt mật khẩu mới (link hết hạn sau 1 giờ).</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Đặt lại mật khẩu</a>
      </p>
      <p style="color:#64748b;font-size:13px">Nếu bạn không yêu cầu, có thể bỏ qua email này.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">— ${APP_NAME}</p>
    </div>`,
    text: `Đặt lại mật khẩu cho tài khoản. Mở link sau (hết hạn trong 1 giờ): ${resetUrl}\n\nNếu không yêu cầu, bỏ qua email này.\n\n— ${APP_NAME}`,
  });
}

export async function sendPaymentSuccessEmail(
  to: string,
  args: { planType: string; amount: number; orderCode: number; expiresAt: Date },
): Promise<boolean> {
  const expires = args.expiresAt.toLocaleDateString("vi-VN");
  const amountVND = args.amount.toLocaleString("vi-VN");
  return sendEmail({
    to,
    subject: `Thanh toán thành công — Gói ${args.planType}`,
    html: `<div style="${BASE_STYLE}">
      <h2 style="color:#16a34a;margin:0 0 12px">Thanh toán thành công ✓</h2>
      <p>Cảm ơn bạn đã nâng cấp lên gói <b>${args.planType}</b>.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:16px;width:100%;margin:16px 0;border-collapse:separate;border-spacing:0 4px">
        <tr><td style="color:#64748b">Mã đơn</td><td style="text-align:right;font-family:monospace">${args.orderCode}</td></tr>
        <tr><td style="color:#64748b">Số tiền</td><td style="text-align:right">${amountVND} ₫</td></tr>
        <tr><td style="color:#64748b">Hết hạn</td><td style="text-align:right">${expires}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">— ${APP_NAME}</p>
    </div>`,
    text: `Thanh toán thành công cho gói ${args.planType}.\nMã đơn: ${args.orderCode}\nSố tiền: ${amountVND} ₫\nHết hạn: ${expires}\n\n— ${APP_NAME}`,
  });
}
