import { ingredientWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,routeError } from '@/server/http'
import { listIngredients,saveIngredient } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);const u=new URL(request.url);const active=u.searchParams.get('active');return Response.json(await listIngredients(u.searchParams.get('search')??'',active===null?undefined:active==='true'))}catch(e){return routeError(e)}}
export async function POST(request: Request){try{await requireAdmin(request as never);await saveIngredient(null,await readJson(request,ingredientWriteSchema));return new Response(null,{status:201})}catch(e){return routeError(e)}}
