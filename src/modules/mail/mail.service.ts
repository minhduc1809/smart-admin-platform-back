import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('SMTP Mail Transporter initialized successfully');
    } else {
      this.logger.warn(
        'SMTP configuration missing. MailService is running in DEV mode (emails will be logged to console only).',
      );
    }
  }

  async sendResetPasswordEmail(email: string, token: string, tenantId: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:8000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&tenantId=${tenantId}`;

    if (this.transporter) {
      const from = this.config.get<string>('SMTP_FROM', '"Smart Admin System" <noreply@example.com>');
      const mailOptions = {
        from,
        to: email,
        subject: '[Smart Admin] Yêu cầu khôi phục mật khẩu',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #1f3864; border-bottom: 2px solid #2e75b6; padding-bottom: 10px;">Khôi phục mật khẩu tài khoản</h2>
            <p>Chào bạn,</p>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên hệ thống <strong>Smart Admin Platform</strong>.</p>
            <p>Vui lòng nhấn vào nút bên dưới để tiến hành đặt lại mật khẩu mới (Đường dẫn có hiệu lực trong vòng 15 phút):</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                Đặt lại mật khẩu
              </a>
            </div>
            <p>Hoặc sao chép đường dẫn này và dán vào thanh địa chỉ của trình duyệt:</p>
            <p style="word-break: break-all; color: #5f6368; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 13px;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
            <p style="font-size: 12px; color: #70757a;">Nếu bạn không yêu cầu hành động này, bạn có thể bỏ qua email này một cách an toàn. Mật khẩu của bạn vẫn sẽ được giữ nguyên.</p>
          </div>
        `,
      };

      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`[MailService] Reset password email sent successfully to ${email}`);
      } catch (error) {
        this.logger.error(`[MailService] Failed to send email to ${email}:`, error);
        // Fallback log to console so developers can still get the link if SMTP errors out
        this.logger.log(`[MailService] Fallback Reset Link: ${resetUrl}`);
      }
    } else {
      this.logger.log(`[MailService][DEV MODE] Sending reset password email to ${email}`);
      this.logger.log(`[MailService][DEV MODE] Reset Link: ${resetUrl}`);
    }
  }
}
