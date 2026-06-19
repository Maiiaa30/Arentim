import { z } from 'zod';

/** Strong-ish password policy (A07): length + mixed character classes. */
export const passwordSchema = z
  .string()
  .min(10, 'Use pelo menos 10 caracteres')
  .max(72, 'Palavra-passe demasiado longa') // bcrypt input limit
  .regex(/[a-z]/, 'Inclua uma letra minúscula')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
  .regex(/[0-9]/, 'Inclua um número');

export const displayNameSchema = z
  .string()
  .trim()
  .min(3, 'Pelo menos 3 caracteres')
  .max(24, 'No máximo 24 caracteres')
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Apenas letras, números, espaços, _ e -');

export const loginSchema = z.object({
  email: z.string().email('Introduza um email válido'),
  password: z.string().min(1, 'Introduza a sua palavra-passe'),
});

export const signupSchema = z.object({
  email: z.string().email('Introduza um email válido'),
  displayName: displayNameSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
