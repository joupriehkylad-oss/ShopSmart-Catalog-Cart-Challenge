import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '../lib/prisma.js';

const router = Router();
const scryptAsync = promisify(scrypt);

const COOKIE_NAME = 'shopsmart_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

const SCRYPT_OPTIONS = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024
};

const publicUser = {
  id: true,
  name: true,
  email: true
};

// Account validation

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
});

// Prevent excessive authentication requests

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again later.'
    }
  }
});

function sendError(response, status, code, message) {
  return response.status(status).json({
    error: { code, message }
  });
}

// Password hashing

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');

  const key = await scryptAsync(
    password,
    salt,
    64,
    SCRYPT_OPTIONS
  );

  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  const [salt, hash] = storedPassword.split(':');

  if (!salt || !hash) {
    return false;
  }

  const storedKey = Buffer.from(hash, 'hex');

  const suppliedKey = await scryptAsync(
    password,
    salt,
    64,
    SCRYPT_OPTIONS
  );

  if (storedKey.length !== suppliedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, suppliedKey);
}

// Session management

function hashToken(token) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api'
  };
}

function getSessionToken(request) {
  const token = request.cookies?.[COOKIE_NAME];

  return typeof token === 'string' &&
    /^[a-f0-9]{64}$/.test(token)
    ? token
    : null;
}

async function createSession(request, response, userId) {
  const token = randomBytes(32).toString('hex');

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION
  );

  const oldToken = getSessionToken(request);

  const operations = [];

  if (oldToken) {
    operations.push(
      prisma.session.deleteMany({
        where: { tokenHash: hashToken(oldToken) }
      })
    );
  }

  operations.push(
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt
      }
    })
  );

  await prisma.$transaction(operations);

  response.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SESSION_DURATION
  });
}

// Origin protection

export function requireTrustedOrigin(
  request,
  response,
  next
) {
  const allowedOrigin =
    process.env.FRONTEND_URL ||
    'http://localhost:5173';

  if (request.get('origin') !== allowedOrigin) {
    return sendError(
      response,
      403,
      'INVALID_ORIGIN',
      'Request origin is not allowed.'
    );
  }

  next();
}

// Authentication middleware

export async function requireAuth(
  request,
  response,
  next
) {
  try {
    const token = getSessionToken(request);

    if (!token) {
      return sendError(
        response,
        401,
        'UNAUTHORIZED',
        'Please sign in first.'
      );
    }

    const session = await prisma.session.findUnique({
      where: {
        tokenHash: hashToken(token)
      },
      include: {
        user: {
          select: publicUser
        }
      }
    });

    if (!session || session.expiresAt <= new Date()) {
      return sendError(
        response,
        401,
        'SESSION_EXPIRED',
        'Please sign in again.'
      );
    }

    request.user = session.user;

    next();

  } catch (error) {
    next(error);
  }
}

router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

// Register

router.post(
  '/register',
  requireTrustedOrigin,
  authLimiter,
  async (request, response, next) => {
    try {
      const parsed = registerSchema.safeParse(
        request.body
      );

      if (!parsed.success) {
        return sendError(
          response,
          422,
          'INVALID_REGISTRATION',
          'Enter valid details and a password of at least 12 characters.'
        );
      }

      const { name, email, password } = parsed.data;

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash
        },
        select: publicUser
      });

      await createSession(request, response, user.id);

      response.status(201).json({
        message: 'Registration successful.',
        user
      });

    } catch (error) {
      if (error.code === 'P2002') {
        return sendError(
          response,
          409,
          'EMAIL_EXISTS',
          'Unable to register with this email.'
        );
      }

      next(error);
    }
  }
);

// Login

router.post(
  '/login',
  requireTrustedOrigin,
  authLimiter,
  async (request, response, next) => {
    try {
      const parsed = loginSchema.safeParse(
        request.body
      );

      if (!parsed.success) {
        return sendError(
          response,
          422,
          'INVALID_LOGIN',
          'Enter a valid email and password.'
        );
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      const dummyHash =
        '00000000000000000000000000000000:' +
        '00'.repeat(64);

      const validPassword = await verifyPassword(
        password,
        user?.passwordHash || dummyHash
      );

      if (!user || !validPassword) {
        return sendError(
          response,
          401,
          'INVALID_CREDENTIALS',
          'Incorrect email or password.'
        );
      }

      await createSession(request, response, user.id);

      response.json({
        message: 'Login successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Current user

router.get('/me', requireAuth, (request, response) => {
  response.json({
    user: request.user
  });
});

// Logout

router.post(
  '/logout',
  requireTrustedOrigin,
  async (request, response, next) => {
    try {
      const token = getSessionToken(request);

      if (token) {
        await prisma.session.deleteMany({
          where: {
            tokenHash: hashToken(token)
          }
        });
      }

      response.clearCookie(
        COOKIE_NAME,
        cookieOptions()
      );

      response.status(204).end();

    } catch (error) {
      next(error);
    }
  }
);

export default router;