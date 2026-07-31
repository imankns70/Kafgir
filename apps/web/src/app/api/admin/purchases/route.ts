import { purchaseWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,routeError } from '@/server/http'
import { createPurchase,listPurchases } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);const s=new URL(request.url).searchParams.get('status');return Response.json(await listPurchases(s?Number(s):undefined))}catch(e){return routeError(e)}}
export async function POST(request: Request){try{const admin=await requireAdmin(request as never);const id=await createPurchase(await readJson(request,purchaseWriteSchema),admin.userId);return Response.json({id},{status:201})}catch(e){return routeError(e)}}
