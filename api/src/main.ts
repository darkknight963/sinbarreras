import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }));
  app.use(json({ limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));
  app.use(urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.PUBLIC_FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(',').map((origin) => origin.trim()).filter(Boolean));

  // Only whitelist explicitly configured extension origins (e.g. chrome-extension://EXTENSION_ID)
  const allowedExtensionOrigins = new Set(
    (process.env.ALLOWED_EXTENSION_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.startsWith('chrome-extension://') || o.startsWith('moz-extension://')),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = [
        'http://localhost',
        'http://localhost:80',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1',
        'http://127.0.0.1:80',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        'https://sinbarreras.gzakgroup.com',
        'https://www.sinbarreras.gzakgroup.com',
        ...configuredOrigins,
      ];

      if (!origin || allowedOrigins.includes(origin) || allowedExtensionOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);
}
bootstrap();
