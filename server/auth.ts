import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users } from "@db/schema";
import { db } from "@db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

const scryptAsync = promisify(scrypt);

const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// Registration validation schema
const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionMiddleware = session({
    secret: process.env.REPL_ID || "travel-allowance-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  });

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionMiddleware.cookie = {
      secure: true,
    };
  }

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to accept either username or email for login
  passport.use(new LocalStrategy({
    usernameField: 'username', // This can be either username or email
    passwordField: 'password'
  }, async (username, password, done) => {
    try {
      // Try to find user by username or email
      const [user] = await db
        .select()
        .from(users)
        .where(or(
          eq(users.username, username),
          eq(users.email, username)
        ))
        .limit(1);

      if (!user) {
        return done(null, false, { message: "Incorrect username or email." });
      }

      const isMatch = await crypto.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Create initial superadmin user
  const createSuperAdmin = async () => {
    try {
      const [existingSuperAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'jelic.dusan@gmail.com'))
        .limit(1);

      if (!existingSuperAdmin) {
        const hashedPassword = await crypto.hash('admin123');
        await db.insert(users).values({
          username: 'superadmin',
          email: 'jelic.dusan@gmail.com',
          password: hashedPassword,
          role: 'super_admin',
          isAdmin: true,
        });
        console.log('Superadmin account created successfully');
      }
    } catch (error) {
      console.error('Error creating superadmin:', error);
    }
  };

  // Auth routes
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(400).send(info?.message || "Login failed");
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            isAdmin: user.isAdmin,
          },
        });
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = registrationSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { username, password, email, firstName, lastName } = result.data;

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(or(
          eq(users.username, username),
          eq(users.email, email)
        ))
        .limit(1);

      if (existingUser) {
        if (existingUser.username === username) {
          return res.status(400).send("Username already exists");
        }
        return res.status(400).send("Email already exists");
      }

      // Create new user
      const hashedPassword = await crypto.hash(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          firstName,
          lastName,
          role: 'user',
          isAdmin: false,
        })
        .returning();

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
            isAdmin: newUser.isAdmin,
          },
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    // Fetch full user data including all profile fields
    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!userData) {
      return res.status(404).send("User not found");
    }

    res.json(userData);
  });

  // Create/update initial superadmin account
  createSuperAdmin();

  return sessionMiddleware;
}