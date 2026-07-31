import { purchasePaymentWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { registerPurchasePayment } from '@/server/services/v15-service'
export async function POST(request:Request){try{const a=await requireAdmin(request as never);await registerPurchasePayment(await readJson(request,purchasePaymentWriteSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
