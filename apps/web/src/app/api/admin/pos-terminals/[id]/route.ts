import { posTerminalWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { savePosTerminal } from '@/server/services/v15-service'
export async function PUT(request: Request,context:{params:Promise<{id:string}>}){try{await requireAdmin(request as never);await savePosTerminal(Number((await context.params).id),await readJson(request,posTerminalWriteSchema));return noContent()}catch(e){return routeError(e)}}
