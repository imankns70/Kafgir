import { z } from 'zod'

/** The three Admin roles. Owner can do everything; the other two see their own work. */
export const adminRoleSchema = z.enum(['Owner', 'OrderManager', 'KitchenAdmin'])

export const adminRoleLabels: Record<z.infer<typeof adminRoleSchema>, string> = {
  Owner: 'مالک',
  OrderManager: 'مدیر سفارش‌ها',
  KitchenAdmin: 'آشپزخانه',
}

const password = z.string().min(8, 'رمز عبور دست‌کم ۸ نویسه است.').max(128)
const roles = z.array(adminRoleSchema).min(1, 'دست‌کم یک نقش انتخاب کنید.').transform((value) => [...new Set(value)])

export const staffUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  fullName: z.string(),
  roles: z.array(adminRoleSchema),
  isActive: z.boolean(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
})

export const staffCreateSchema = z.object({
  username: z.string().trim().min(3, 'نام کاربری دست‌کم ۳ نویسه است.').max(60)
    .regex(/^[A-Za-z0-9._-]+$/u, 'نام کاربری فقط حروف انگلیسی، عدد، نقطه و خط تیره دارد.'),
  fullName: z.string().trim().min(2).max(150),
  password,
  roles,
})

export const staffUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  roles,
  isActive: z.boolean(),
})

export const staffPasswordSchema = z.object({ password })

export type AdminRole = z.infer<typeof adminRoleSchema>
export type StaffUserDto = z.infer<typeof staffUserSchema>
export type StaffCreateRequest = z.infer<typeof staffCreateSchema>
export type StaffUpdateRequest = z.infer<typeof staffUpdateSchema>
export type StaffPasswordRequest = z.infer<typeof staffPasswordSchema>
