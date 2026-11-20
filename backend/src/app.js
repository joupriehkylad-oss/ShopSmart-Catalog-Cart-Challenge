import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import assistantRouter from './routes/assistant.js';
import authRouter from './routes/auth.js';

export function createApp() {
  const app = express();

  // Security middleware
  app.disable('x-powered-by');
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));

  // Request body and cookie parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Request tracking
  app.use((request, response, next) => {
    request.id = crypto.randomUUID();

    response.setHeader(
      'X-Request-ID',
      request.id
    );

    next();
  });

  // Request logging
  app.use(morgan(':method :url :status :response-time ms'));

  // Health check
  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok'
    });
  });

  // Authentication routes
  app.use('/api/auth', authRouter);

  // Existing ShopSmart routes
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/assistant', assistantRouter);

  // Handle unknown routes
  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'API route could not be found.'
      }
    });
  });

  // Global error handler
  app.use((error, request, response, _next) => {
    console.error(`[${request.id}]`, error);

    response.status(error.status || 500).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.status
          ? error.message
          : 'The server could not complete the request.',
        traceId: request.id
      }
    });
  });

  return app;
}