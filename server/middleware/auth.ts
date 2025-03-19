import type { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

// Middleware to check if user is authenticated and attach full user object
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  console.log('Authentication check - Session:', req.session);
  console.log('Authentication check - User:', req.user);

  if (!req.isAuthenticated()) {
    console.log('User not authenticated');
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    // Fetch full user object from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id)
    });

    console.log('Fetched user from database:', user);

    if (!user) {
      console.log('User not found in database');
      return res.status(401).json({ message: "User not found" });
    }

    // Attach full user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in authentication middleware:', error);
    return res.status(500).json({ message: "Authentication error" });
  }
};
