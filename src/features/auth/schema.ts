import { z } from 'zod';

/** Strong-ish password policy (A07): length + mixed character classes. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Password is too long') // bcrypt input limit
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const displayNameSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(24, 'At most 24 characters')
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Letters, numbers, spaces, _ and - only');

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  displayName: displayNameSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
