import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { mkdir } from 'node:fs/promises';
import { AppModule } from './app.module';
import { uploadDir } from './profile.controller';
import { clientOrigins, validateEnvironment } from './security';
import { HttpErrors } from './http-errors';

export async function createApplication(test = false) {
  validateEnvironment();
  const production = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({
    bodyLimit: 1024 * 1024,
    logger: production ? { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'], serializers: { req: (req: { method: string; id: string; url?: string }) => ({ method: req.method, id: req.id, path: req.url?.split('?')[0] }) } } : false,
    trustProxy: process.env.TRUSTED_PROXY || false,
  }), { logger: test ? false : new ConsoleLogger({ json: production }) });
  app.enableCors({ origin: clientOrigins(), credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] });
  app.useGlobalFilters(new HttpErrors());
  app.setGlobalPrefix('v1');
  const instance = app.getHttpAdapter().getInstance();
  instance.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (request.url.startsWith('/v1/')) reply.header('Cache-Control', 'no-store');
    if (production) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });
  await instance.register(multipart as any, { limits: { fileSize: 8 * 1024 * 1024, files: 6, fields: 4, parts: 10 } });
  await mkdir(uploadDir, { recursive: true });
  await instance.register(fastifyStatic as any, { root: uploadDir, prefix: '/uploads/', index: false, list: false, setHeaders: (res: any) => { res.header('Cache-Control', 'public, max-age=3600'); } });
  await instance.register(rateLimit as any, { max: 120, timeWindow: '1 minute' });
  if (!test) app.enableShutdownHooks();
  return app;
}
