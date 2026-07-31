import { requireAdmin } from '@/server/auth/jwt'
import { noContent,routeError } from '@/server/http'
import { cancelPurchase } from '@/server/services/v15-service'
export async function POST(request: Request,context:{params:Promise<{id:string}>}){try{const a=await requireAdmin(request as never);await cancelPurchase(Number((await context.params).id),a.userId);return noContent()}catch(e){return routeError(e)}}
