import { unitWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { listUnits, saveUnit } from '@/server/services/v15-service'
export async function GET(request: Request) { try { await requireAdmin(request as never); return Response.json(await listUnits()) } catch (e) { return routeError(e) } }
export async function POST(request: Request) { try { await requireAdmin(request as never); await saveUnit(null, await readJson(request, unitWriteSchema)); return new Response(null,{status:201}) } catch(e){ return routeError(e) } }
