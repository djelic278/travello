import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import path from "path";
import fs from "fs";
import { getDb } from "@db";
import { createServer } from 'http';

// Create Express app
const app = express();

// Basic middleware setup
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up static file serving for uploads
app.use('/uploads', express.static(uploadsDir));

// Initialize server
(async () => {
  try {
    // Initialize database connection first
    log("Initializing database connection...");
    const db = await getDb();
    log("Database connection established successfully");

    // Set up authentication after database is ready
    log("Setting up authentication...");
    setupAuth(app);
    log("Authentication setup complete");

    // Create HTTP server
    const server = createServer(app);

    // Register routes after auth setup
    log("Registering routes...");
    registerRoutes(app, server);
    log("Routes registered");

    // Set up Vite or static serving as the last middleware
    log("Setting up frontend server...");
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    log("Frontend server setup complete");

    // Global error handler must be after all routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();