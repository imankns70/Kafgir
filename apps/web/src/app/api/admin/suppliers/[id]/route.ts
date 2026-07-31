import { supplierWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { saveSupplier } from '@/server/services/v15-service'
export async function PUT(request: Request,context:{params:Promise<{id:string}>}){try{await requireAdmin(request as never);await saveSupplier(Number((await context.params).id),await readJson(request,supplierWriteSchema));return noContent()}catch(e){return routeError(e)}}
