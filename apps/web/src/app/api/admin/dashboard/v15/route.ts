import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { v15Dashboard } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);return Response.json(await v15Dashboard())}catch(e){return routeError(e)}}
