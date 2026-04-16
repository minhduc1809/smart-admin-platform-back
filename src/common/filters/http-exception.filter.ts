import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { I18nService } from 'nestjs-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let messageStr = 'Internal server error';

    if (exception instanceof HttpException) {
      const responseBody: any = exception.getResponse();
      messageStr = typeof responseBody === 'object' ? responseBody.message : responseBody;
      
      // Attempt i18n translation if it maps to a key (e.g. "error.NOT_FOUND")
      if (typeof messageStr === 'string' && messageStr.includes('.')) {
        try {
          messageStr = await this.i18n.translate(messageStr, { 
            lang: request.i18nLang || 'en' 
          });
        } catch (e) {
          // fallback to original if translation fails
        }
      } else if (Array.isArray(messageStr)) {
        // Handle class-validator messages
        messageStr = messageStr[0]; 
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: messageStr,
      data: null,
    });
  }
}