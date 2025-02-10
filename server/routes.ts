import { Express, Request, Response } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { loginSchema, insertCaseSchema } from "@shared/schema";
import { analyzeContent } from "./services/ai";
import session from "express-session";
import MemoryStore from "memorystore";

// Extend session type to include userId
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const SessionStore = MemoryStore(session);

export function registerRoutes(app: Express) {
  // Session setup
  app.use(
    session({
      store: new SessionStore({ checkPeriod: 86400000 }),
      secret: "keyboard cat",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );

  // Authentication
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(data.username);

      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/users/me", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ ...user, password: undefined });
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // User status
  app.post("/api/users/status", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { status } = req.body;
    const user = await storage.updateUserStatus(userId, status);
    res.json({ ...user, password: undefined });
  });

  // Content queue
  app.get("/api/content", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = await storage.getContentItems();
    res.json(items);
  });

  // Modified content queue route to include AI analysis
  app.get("/api/content/next", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const nextItem = await storage.getNextContentItem();
      if (!nextItem) {
        return res.status(404).json({ message: "No content available" });
      }

      // Only analyze if no AI analysis exists
      if (!nextItem.metadata.aiAnalysis) {
        const analysis = await analyzeContent(nextItem.content, nextItem.type);
        await storage.updateContentItem(nextItem.id, {
          metadata: {
            ...nextItem.metadata,
            aiAnalysis: analysis,
          },
        });
        nextItem.metadata.aiAnalysis = analysis;
      }

      res.json(nextItem);
    } catch (error) {
      console.error("Error processing content:", error);
      res.status(500).json({ message: "Error processing content" });
    }
  });


  // Case management
  app.post("/api/cases", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const data = insertCaseSchema.parse({ ...req.body, agentId: userId });
      const newCase = await storage.createCase(data);

      // Update content item status
      await storage.updateContentItem(data.contentId, {
        status: data.decision || "pending",
        assignedTo: userId,
      });

      res.json(newCase);
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/cases", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cases = await storage.getCases();
    const userCases = cases.filter(c => c.agentId === userId);
    res.json(userCases);
  });

  const httpServer = createServer(app);
  return httpServer;
}