import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT'));
    const user = this.config.get<string>('SMTP_USER');
    const pass =
      this.config.get<string>('SMTP_PASS') ||
      this.config.get<string>('SMTP_PASSWORD');
    const clientId = this.config.get<string>('SMTP_OAUTH_CLIENT_ID');
    const clientSecret = this.config.get<string>('SMTP_OAUTH_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('SMTP_OAUTH_REFRESH_TOKEN');
    const accessToken = this.config.get<string>('SMTP_OAUTH_ACCESS_TOKEN');

    // Prefer OAuth2 (XOAUTH2) over password auth
    let auth: SMTPTransport.Options['auth'];
    let authMode = 'disabled';
    if (user && clientId && clientSecret && refreshToken) {
      // Full OAuth2: nodemailer auto-refreshes the access token when it expires
      auth = {
        type: 'OAuth2',
        user,
        clientId,
        clientSecret,
        refreshToken,
        ...(accessToken ? { accessToken } : {}),
      };
      authMode = 'oauth2';
    } else if (user && accessToken) {
      // Static access token only (no auto-refresh — token must be renewed externally)
      auth = { type: 'OAuth2', user, accessToken };
      authMode = 'oauth2 (static access token)';
    } else if (user && pass) {
      auth = { user, pass };
      authMode = 'password';
    }

    if (host && port) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth,
      });
      this.logger.log(
        `SMTP Mail Transporter initialized successfully (auth: ${authMode})`,
      );
    } else {
      this.logger.warn(
        'SMTP configuration missing. MailService is running in DEV mode (emails will be logged to console only).',
      );
    }
  }

  async sendResetOtpEmail(email: string, otp: string) {
    if (this.transporter) {
      const from = this.config.get<string>('SMTP_FROM', '"Smart Admin System" <noreply@example.com>');
      const mailOptions = {
        from,
        to: email,
        subject: '[Smart Admin] Mã xác thực khôi phục mật khẩu',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #1f3864; border-bottom: 2px solid #2e75b6; padding-bottom: 10px;">Khôi phục mật khẩu tài khoản</h2>
            <p>Chào bạn,</p>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên hệ thống <strong>Smart Admin Platform</strong>.</p>
            <p>Mã xác thực (OTP) của bạn là:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; background-color: #f0f5ff; color: #1f3864; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">
                ${otp}
              </span>
            </div>
            <p>Nhập mã này vào màn hình khôi phục mật khẩu. Mã có hiệu lực trong vòng <strong>10 phút</strong> và chỉ sử dụng được một lần.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
            <p style="font-size: 12px; color: #70757a;">Nếu bạn không yêu cầu hành động này, bạn có thể bỏ qua email này một cách an toàn. Mật khẩu của bạn vẫn sẽ được giữ nguyên. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
          </div>
        `,
      };

      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`[MailService] Reset OTP email sent successfully to ${email}`);
      } catch (error) {
        this.logger.error(`[MailService] Failed to send email to ${email}:`, error);
        // Fallback log to console so developers can still get the code if SMTP errors out
        this.logger.log(`[MailService] Fallback Reset OTP: ${otp}`);
      }
    } else {
      this.logger.log(`[MailService][DEV MODE] Sending reset OTP email to ${email}`);
      this.logger.log(`[MailService][DEV MODE] Reset OTP: ${otp}`);
    }
  }
}
