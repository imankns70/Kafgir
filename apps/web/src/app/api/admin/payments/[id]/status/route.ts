import { paymentStatusWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { changePaymentStatus } from '@/server/services/v15-service'
export async function PATCH(request: Request,context:{params:Promise<{id:string}>}){try{const a=await requireAdmin(request as never);await changePaymentStatus(Number((await context.params).id),await readJson(request,paymentStatusWriteSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
