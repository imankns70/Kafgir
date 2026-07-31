import { ingredientCategoryWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { saveIngredientCategory } from '@/server/services/v15-service'
export async function PUT(request: Request,context:{params:Promise<{id:string}>}){try{await requireAdmin(request as never);const body=await readJson(request,ingredientCategoryWriteSchema);await saveIngredientCategory(Number((await context.params).id),body.name,body.isActive);return noContent()}catch(e){return routeError(e)}}
