import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection options
const connectionConfig = {
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
};

// Initialize database with error handling
let db: ReturnType<typeof drizzle>;
try {
  db = drizzle(connectionConfig);
  console.log("Database connection established successfully");
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  throw error;
}

export { db };