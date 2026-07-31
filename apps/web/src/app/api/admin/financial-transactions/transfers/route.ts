import { accountTransferSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { transfer } from '@/server/services/v15-service'
export async function POST(request: Request){try{const a=await requireAdmin(request as never);await transfer(await readJson(request,accountTransferSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
