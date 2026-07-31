import { financialEntrySchema } from '@kafgir/contracts'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { createFinancialEntry,listFinancialTransactions } from '@/server/services/v15-service'
const entry=z.object({kind:z.enum(['income','expense']),entry:financialEntrySchema})
export async function GET(request: Request){try{await requireAdmin(request as never);const q=new URL(request.url).searchParams;return Response.json(await listFinancialTransactions(q.get('from')??undefined,q.get('to')??undefined))}catch(e){return routeError(e)}}
export async function POST(request: Request){try{const a=await requireAdmin(request as never);const b=await readJson(request,entry);await createFinancialEntry(b.entry,b.kind,a.userId);return noContent()}catch(e){return routeError(e)}}
