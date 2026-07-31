import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { managerialReports } from '@/server/services/v15-service'
export async function GET(request:Request){try{await requireAdmin(request as never);const q=new URL(request.url).searchParams;const from=q.get('from')??new Date().toISOString().slice(0,10);const to=q.get('to')??from;return Response.json(await managerialReports(from,to))}catch(e){return routeError(e)}}
