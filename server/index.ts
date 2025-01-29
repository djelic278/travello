import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { setupAuth } from "./auth";
import { sql } from "drizzle-orm";
import "dotenv/config";
import { createServer } from "http";
import net from "net";

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup authentication and get session middleware
const sessionMiddleware = setupAuth(app);

// Make session middleware available to the app
app.set('session', sessionMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: app.get('env') });
});

// Function to check if a port is available
const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port, '0.0.0.0');
  });
};

// Function to find an available port
const findAvailablePort = async (startPort: number, maxAttempts: number = 10): Promise<number> => {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts - 1}`);
};

// Initialize server
(async () => {
  let server;

  try {
    // Test database connection with timeout
    log("Testing database connection...");
    const dbTimeout = setTimeout(() => {
      throw new Error("Database connection timeout after 10 seconds");
    }, 10000);

    const result = await db.execute(sql`SELECT 1 + 1 AS result`);
    clearTimeout(dbTimeout);

    if (!result) {
      throw new Error("Database connection test failed");
    }
    log("Database connection successful");

    // Register routes
    log("Registering routes...");
    server = registerRoutes(app);
    log("Routes registered successfully");

    // Set up Vite or static serving based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log("Vite development server initialized");
    } else {
      serveStatic(app);
      log("Static files serving initialized for production");
    }

    // Enhanced global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error occurred: ${status} - ${err.message || err}`);

      res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });

    // Try to start server on port 5000 or find an available port
    const PORT = await findAvailablePort(5000);

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT} in ${app.get("env")} mode`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async () => {
      log("Received shutdown signal. Starting graceful shutdown...");
      server.close(() => {
        log("HTTP server closed");
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();