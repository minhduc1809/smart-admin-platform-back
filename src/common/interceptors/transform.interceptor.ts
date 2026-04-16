import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(map(data => {
      // If data is paginated (has result and total property)
      if (data && typeof data === 'object' && 'result' in data && 'total' in data) {
        return {
          success: true,
          statusCode,
          message: 'Success',
          data
        };
      }
      return {
        success: true,
        statusCode,
        message: 'Success',
        data
      };
    }));
  }
}