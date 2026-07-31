import { paymentWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,routeError } from '@/server/http'
import { createPayment,listPayments } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);return Response.json(await listPayments())}catch(e){return routeError(e)}}
export async function POST(request: Request){try{const a=await requireAdmin(request as never);const id=await createPayment(await readJson(request,paymentWriteSchema),a.userId);return Response.json({id},{status:201})}catch(e){return routeError(e)}}
