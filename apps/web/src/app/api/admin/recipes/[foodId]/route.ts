import { recipeWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { getRecipe,saveRecipe } from '@/server/services/v15-service'
export async function GET(request: Request,context:{params:Promise<{foodId:string}>}){try{await requireAdmin(request as never);return Response.json(await getRecipe(Number((await context.params).foodId)))}catch(e){return routeError(e)}}
export async function PUT(request: Request,context:{params:Promise<{foodId:string}>}){try{const a=await requireAdmin(request as never);await saveRecipe(Number((await context.params).foodId),await readJson(request,recipeWriteSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
