import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create postgres connection with connection pooling
const client = postgres(process.env.DATABASE_URL, {
  max: 1, // Adjust pool size based on Replit's limitations
  idle_timeout: 20,
  connect_timeout: 10,
});

// Export both the client and db instance
export const db = drizzle(client, { schema });
export { client };