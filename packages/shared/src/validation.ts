import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().trim().email().toLowerCase();
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Phone number must be in international format')
  .optional()
  .or(z.literal(''));

export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: passwordSchema,
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  avatar: z.string().url().optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const createUserSchema = profileSchema.extend({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['ADMIN', 'DEVELOPER', 'CLIENT']),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']).default('ACTIVE'),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  emailVerified: z.boolean().optional(),
});
