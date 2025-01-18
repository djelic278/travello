import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { setupAuth } from "./auth";
import { sql } from "drizzle-orm";
import "dotenv/config";

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

// Basic middleware setup with security headers and CORS for development
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for development
app.use((req, res, next) => {
  // Allow requests from any origin in development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// Setup authentication and get session middleware
const sessionMiddleware = setupAuth(app);

// Make session middleware available to the app
app.set('session', sessionMiddleware);

// Request logging middleware with enhanced error tracking
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    let logLine = `${req.method} ${path} ${status} in ${duration}ms`;

    if (status >= 400) {
      logLine = `ERROR: ${logLine}`;
    }

    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: app.get('env') });
});

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
      const message = process.env.NODE_ENV === 'production'
        ? "Internal Server Error"
        : (err.message || "Internal Server Error");

      log(`Error occurred: ${status} - ${err.message || err}`);

      // Send minimal error details in production
      res.status(status).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });

    // Start server
    const PORT = Number(process.env.PORT) || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT} in ${app.get("env")} mode`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async () => {
      log("Received shutdown signal. Starting graceful shutdown...");

      // Close database connections if possible
      try {
        if (db.$client && typeof db.$client.end === 'function') {
          await db.$client.end();
          log("Database connections closed");
        }
      } catch (error) {
        console.error("Error closing database connections:", error);
      }

      // Exit process
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();