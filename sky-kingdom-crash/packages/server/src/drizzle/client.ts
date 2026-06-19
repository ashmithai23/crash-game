// Drizzle client configuration (updated to PostgreSQL)

export const client = await drizzle.createClient({
  url: 'postgresql://localhost:5432/gamingdb',  // Changed from Redis to PostgreSQL
  schemaDefinition: require('./schema.d.ts')
});