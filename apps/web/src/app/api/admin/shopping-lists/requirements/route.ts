import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { shoppingRequirements } from '@/server/services/v15-service'
export async function GET(request:Request){try{await requireAdmin(request as never);const q=new URL(request.url).searchParams;const from=q.get('from'),to=q.get('to');if(!from||!to)return Response.json({error:'بازه تاریخ الزامی است.'},{status:400});return Response.json(await shoppingRequirements(from,to))}catch(e){return routeError(e)}}
