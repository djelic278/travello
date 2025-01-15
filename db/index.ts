import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let db: ReturnType<typeof drizzle>;
let retries = 5;

// Initialize database with error handling and retries
async function initializeDatabase() {
  try {
    if (!db) {
      while (retries > 0) {
        try {
          // Configure neon
          neonConfig.fetchConnectionCache = true;

          // Create SQL client
          const sql = neon(process.env.DATABASE_URL!);

          // Create drizzle client
          db = drizzle(sql, { schema });

          // Test the connection
          await db.select().from(schema.users).limit(1);
          console.log("Database connection established successfully");
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.log(`Database connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    return db;
  } catch (error) {
    console.error("Failed to initialize database connection:", error);
    throw error;
  }
}

// Export an async function to get the database instance
export async function getDb() {
  return await initializeDatabase();
}