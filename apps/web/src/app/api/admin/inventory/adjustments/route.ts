import { inventoryAdjustmentSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson,noContent,routeError } from '@/server/http'
import { adjustInventory } from '@/server/services/v15-service'
export async function POST(request: Request){try{const a=await requireAdmin(request as never);await adjustInventory(await readJson(request,inventoryAdjustmentSchema),a.userId);return noContent()}catch(e){return routeError(e)}}
