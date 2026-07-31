import postgres from 'postgres'

declare global {
  // eslint-disable-next-line no-var
  var kafgirSql: ReturnType<typeof postgres> | undefined
}

let configuredConnectionString: string | null = null
let configuredPoolSize: number | null = null
let activeClient: ReturnType<typeof postgres> | undefined

function createClient(connectionString?: string, poolSize?: number) {
  const value = connectionString ?? process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/kafgir'
  return postgres(value, {
    max: poolSize ?? Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  })
}

function currentClient() {
  if (activeClient) return activeClient
  activeClient = configuredConnectionString
    ? createClient(configuredConnectionString, configuredPoolSize ?? 3)
    : globalThis.kafgirSql ?? createClient()
  if (!configuredConnectionString && process.env.NODE_ENV !== 'production') {
    globalThis.kafgirSql = activeClient
  }
  return activeClient
}

export const sqlClient = new Proxy((() => undefined) as unknown as ReturnType<typeof postgres>, {
  apply(_target, thisArg, argumentsList) {
    return Reflect.apply(currentClient(), thisArg, argumentsList)
  },
  get(_target, property) {
    const client = currentClient()
    const value = Reflect.get(client, property)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export async function configureDatabase(connectionString: string, poolSize = 3) {
  const normalized = connectionString.trim()
  if (!normalized) throw new Error('Database connection string is required.')
  if (activeClient) await activeClient.end({ timeout: 5 })
  activeClient = undefined
  configuredConnectionString = normalized
  configuredPoolSize = poolSize
  await currentClient()`SELECT 1`
}

export async function testDatabaseConnection(connectionString?: string) {
  if (!connectionString) {
    await currentClient()`SELECT 1`
    return
  }
  const candidate = createClient(connectionString, 1)
  try {
    await candidate`SELECT 1`
  } finally {
    await candidate.end({ timeout: 2 })
  }
}

export async function closeDatabase() {
  if (!activeClient) return
  const closing = activeClient
  activeClient = undefined
  await closing.end({ timeout: 5 })
}
