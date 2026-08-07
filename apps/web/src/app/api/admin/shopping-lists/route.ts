import { shoppingListCreateSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,routeError } from '@/server/http'
import { createShoppingList, listShoppingLists } from '@/server/services/v15-service'
export async function GET(request:Request){try{await requireAdmin(request as never);return Response.json(await listShoppingLists())}catch(e){return routeError(e)}}
export async function POST(request:Request){try{const a=await requireAdmin(request as never);const id=await createShoppingList(await readJson(request,shoppingListCreateSchema),a.userId);return Response.json({id},{status:201})}catch(e){return routeError(e)}}
