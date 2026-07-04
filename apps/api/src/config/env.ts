import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  COOKIE_SECRET: z.string().min(24),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@clientflow.local'),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
