import { stockCountSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { confirmStockCount } from '@/server/services/v15-service'
export async function POST(request: Request){try{const a=await requireAdmin(request as never);await confirmStockCount(await readJson(request,stockCountSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
