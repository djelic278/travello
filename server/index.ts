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

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Development-specific middleware
app.use((req, res, next) => {
  // Allow all origins for Replit environment
  const origin = req.headers.origin || '';
  if (origin.includes('.replit.dev') || 
      origin.includes('.repl.co') || 
      origin === 'http://localhost:5000') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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


// Setup authentication
const sessionMiddleware = setupAuth(app);
app.set('session', sessionMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: app.get('env'),
    time: new Date().toISOString()
  });
});

// Request logging middleware
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
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize server
(async () => {
  try {
    // Test database connection
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

    // Register routes and create server
    log("Registering routes...");
    const server = registerRoutes(app);
    log("Routes registered successfully");

    // Set up Vite or static serving
    if (app.get("env") === "development") {
      log("Initializing Vite development server...");
      await setupVite(app, server);
      log("Vite development server initialized");
    } else {
      serveStatic(app);
      log("Static files serving initialized for production");
    }

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT} in ${app.get("env")} mode`);
      const serverUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : `http://localhost:${PORT}`;
      log(`Server URL: ${serverUrl}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();