import { ingredientCategoryWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { listIngredientCategories, saveIngredientCategory } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);return Response.json(await listIngredientCategories())}catch(e){return routeError(e)}}
export async function POST(request: Request){try{await requireAdmin(request as never);const body=await readJson(request,ingredientCategoryWriteSchema);await saveIngredientCategory(null,body.name,body.isActive);return new Response(null,{status:201})}catch(e){return routeError(e)}}
