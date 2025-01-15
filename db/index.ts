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
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Idle connection timeout in seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Test database connection on startup
try {
  const result = client`SELECT 1+1 AS result`;
  console.log('Database connection successful');
} catch (error) {
  console.error('Failed to connect to database:', error);
  process.exit(1);
}