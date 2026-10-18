import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpErrors implements ExceptionFilter {
  private logger = new Logger('HttpErrors');
  catch(error: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    const fastifyStatus = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0;
    const status = error instanceof HttpException ? error.getStatus()
      : fastifyStatus >= 400 && fastifyStatus < 500 ? fastifyStatus : code.includes('LIMIT') ? 413 : code === 'P2025' ? 404 : code === 'P2002' ? 409 : 500;
    const response = error instanceof HttpException ? error.getResponse() : null;
    const detail = typeof response === 'string' ? response : response && typeof response === 'object' && 'message' in response ? response.message : null;
    const message = status >= 500 ? 'The server could not complete this request. Please retry.'
      : detail || (status === 429 ? 'Too many requests. Wait a minute and try again.' : status === 413 ? 'Choose an image under 8 MB.' : status === 404 ? 'This item is no longer available.' : status === 409 ? 'That action was already completed. Refresh and retry.' : 'This request could not be completed.');
    if (status >= 500) this.logger.error({ requestId: request.id, status, errorType: error instanceof Error ? error.name : 'UnknownError' });
    const publicCode = response && typeof response === 'object' && 'code' in response && response.code === 'REAUTH_REQUIRED' ? response.code : undefined;
    reply.status(status).send({ statusCode: status, message, requestId: request.id, ...(publicCode ? { code: publicCode } : {}) });
  }
}
