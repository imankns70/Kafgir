import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { listInventoryMovements } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);const i=new URL(request.url).searchParams.get('ingredientId');return Response.json(await listInventoryMovements(i?Number(i):undefined))}catch(e){return routeError(e)}}
