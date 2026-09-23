import { z } from 'zod';

import { idSchema } from '../common/schemas.js';

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Body `POST /categories`. `icon` to klucz ikony z design systemu, nie URL. */
export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  icon: z.string().trim().min(1).max(50),
  color: hexColorSchema,
});

/** Body `PATCH /categories/:id`. */
export const updateCategorySchema = createCategorySchema.partial();

/** Kategoria w odpowiedzi API — systemowe i własne w jednej liście. */
export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  /** Systemowych nie da się edytować ani usunąć. */
  isSystem: z.boolean(),
});

/** Dane nowej kategorii. */
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
/** Zmiany kategorii. */
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
/** Kategoria w odpowiedzi API. */
export type CategoryDto = z.infer<typeof categorySchema>;
