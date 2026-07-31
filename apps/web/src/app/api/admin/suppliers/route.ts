import { supplierWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,routeError } from '@/server/http'
import { listSuppliers,saveSupplier } from '@/server/services/v15-service'
export async function GET(request: Request){try{await requireAdmin(request as never);return Response.json(await listSuppliers())}catch(e){return routeError(e)}}
export async function POST(request: Request){try{await requireAdmin(request as never);await saveSupplier(null,await readJson(request,supplierWriteSchema));return new Response(null,{status:201})}catch(e){return routeError(e)}}
