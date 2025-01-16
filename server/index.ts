import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { db, client } from "@db";

const app = express();

// Basic middleware setup - MUST be before auth setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Graceful shutdown handler
function shutdownGracefully() {
  log("Received shutdown signal. Starting graceful shutdown...");

  // Close database connections
  client.end().then(() => {
    log("Database connections closed.");
    process.exit(0);
  }).catch(err => {
    console.error("Error during database shutdown:", err);
    process.exit(1);
  });
}

// Initialize server
(async () => {
  let server;

  try {
    // Test database connection first
    log("Testing database connection...");
    const result = await client`SELECT 1 + 1 AS result`;
    if (!result || !result[0]) {
      throw new Error("Database connection test failed");
    }
    log("Database connection successful");

    // Set up authentication
    log("Setting up authentication...");
    setupAuth(app);
    log("Authentication setup complete");

    // Register routes
    log("Registering routes...");
    server = registerRoutes(app);
    log("Routes registered successfully");

    // Set up Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log("Vite development server initialized");
    } else {
      serveStatic(app);
      log("Static files serving initialized");
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error occurred: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
    });

    // Setup shutdown handlers
    process.on('SIGTERM', shutdownGracefully);
    process.on('SIGINT', shutdownGracefully);

  } catch (error) {
    console.error('Failed to start server:', error);
    // Attempt to close any open connections
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
    process.exit(1);
  }
})();