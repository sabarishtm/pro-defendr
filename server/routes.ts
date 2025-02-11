import { Express, Request, Response } from "express";
import express from "express";  // Add express import
import { createServer } from "http";
import { storage } from "./storage";
import { loginSchema, insertCaseSchema } from "@shared/schema";
import { analyzeContent } from "./services/ai";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";

// Extend session type to include userId
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const SessionStore = MemoryStore(session);

// Setup multer for file uploads
const storageMulter = multer.diskStorage({
  destination: function (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const uploadDir = path.join(process.cwd(), "uploads");
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({ storage: storageMulter });

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

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Add more detailed logging
      console.log("Login attempt:", {
        username: data.username,
        providedPassword: data.password,
        storedPassword: user.password,
        passwordMatch: data.password === user.password
      });

      if (user.password !== data.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      console.log("Login successful, session:", req.session);
      return res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(400).json({ message: "Invalid request" });
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
  app.get("/api/content/:id", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      const item = await storage.getContentItemWithAssignedUser(contentId);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }

      console.log("Sending content item:", item);
      res.json(item);
    } catch (error) {
      console.error("Error fetching content item:", error);
      res.status(500).json({ message: "Error fetching content item" });
    }
  });

  app.get("/api/content", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const items = await storage.getContentItemsWithAssignedUsers();
      console.log("Sending content items:", items);
      res.json(items);
    } catch (error) {
      console.error("Error fetching content items:", error);
      res.status(500).json({ message: "Error fetching content items" });
    }
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


  // Content creation with AI analysis
  app.post("/api/content", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const newContent = await storage.createContentItem(req.body);

      // Run AI analysis on the new content
      const analysis = await analyzeContent(newContent.content, newContent.type);

      // Update the content with AI analysis
      const updatedContent = await storage.updateContentItem(newContent.id, {
        metadata: {
          ...newContent.metadata,
          aiAnalysis: analysis,
        },
      });

      res.json(updatedContent);
    } catch (error) {
      console.error("Error creating content:", error);
      res.status(400).json({ message: "Failed to create content" });
    }
  });

  // Case management
  app.post("/api/cases", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const data = insertCaseSchema.parse({ ...req.body, agentId: userId });
      const newCase = await storage.createCase(data);
      console.log("Created new case:", newCase);

      // Update content item status
      await storage.updateContentItem(data.contentId, {
        status: data.decision || "pending",
        assignedTo: userId,
      });

      res.json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Add a new endpoint to update case decisions
  app.patch("/api/cases/:id/decision", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }

      const { decision } = req.body;
      if (!decision || !["approved", "rejected"].includes(decision)) {
        return res.status(400).json({ message: "Invalid decision" });
      }

      const case_ = await storage.getCase(caseId);
      if (!case_) {
        return res.status(404).json({ message: "Case not found" });
      }

      if (case_.agentId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this case" });
      }

      const updatedCase = await storage.updateCase(caseId, { 
        decision,
        status: "closed" 
      });

      // Update content item status
      await storage.updateContentItem(case_.contentId, {
        status: decision,
        assignedTo: null, // Assuming the case is closed after decision
      });

      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case decision:", error);
      res.status(500).json({ message: "Error updating case decision" });
    }
  });

  app.get("/api/cases", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cases = await storage.getCases();
    const userCases = cases.filter((c) => c.agentId === userId);
    res.json(userCases);
  });

  // File upload route
  app.post("/api/content/upload", upload.single("file"), async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const fileType = req.body.type || "image"; // Default to image if not specified

      // Get the content name from the request, or generate from filename
      const providedName = req.body.name?.trim();
      const fileName = req.file.originalname.split('.')[0];
      const contentName = providedName || fileName.slice(0, 15);

      const newContent = await storage.createContentItem({
        content: fileUrl,
        type: fileType,
        priority: 1,
        name: contentName,
        metadata: {
          originalMetadata: {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
          }
        }
      });

      // Run AI analysis on the new content
      const analysis = await analyzeContent(fileUrl, fileType);

      // Update the content with AI analysis
      const updatedContent = await storage.updateContentItem(newContent.id, {
        metadata: {
          ...newContent.metadata,
          aiAnalysis: analysis,
        },
      });

      res.json(updatedContent);
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ message: "Error processing upload" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Add delete route before the server export
  app.delete("/api/content/:id", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      const item = await storage.getContentItem(contentId);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Check for existing cases
      const cases = await storage.getCases();
      const contentCases = cases.filter(c => c.contentId === contentId);
      const pendingCases = contentCases.filter(c => c.decision === null);

      let errorMessage = "";

      // If there are pending cases without decisions, block deletion
      if (pendingCases.length > 0) {
        errorMessage = "Content has pending moderation cases awaiting decision";
      }

      // If content is being actively moderated, include moderator information
      if (item.status === "pending" && item.assignedTo) {
        const moderator = await storage.getUser(item.assignedTo);
        errorMessage = moderator 
          ? `Content is currently being moderated by ${moderator.name}`
          : "Content is currently being moderated";
      }

      if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
      }

      // If it's a media file, delete it from the uploads directory
      if ((item.type === 'image' || item.type === 'video') && item.content.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), item.content);
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          console.error("Error deleting file:", error);
          // Continue with content deletion even if file deletion fails
        }
      }

      await storage.deleteContentItem(contentId);
      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Error deleting content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}