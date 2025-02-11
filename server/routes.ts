import { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { loginSchema, insertCaseSchema, decisionSchema, Permission, UserRole } from "@shared/schema";
import { analyzeContent } from "./services/ai";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import { checkPermission, PermissionError } from "./utils/permissions";

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

      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      return res.json({ user: { ...user, password: undefined } });
    } catch (error) {
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

      // If content is pending and not assigned, assign it to the current user
      if (item.status === "pending" && !item.assignedTo) {
        // Create a new case or get existing one
        const cases = await storage.getCases();
        const existingCase = cases.find(c =>
          c.contentId === contentId &&
          c.agentId === userId &&
          !c.decision
        );

        if (!existingCase) {
          // Create new case
          await storage.createCase({
            contentId,
            agentId: userId,
            notes: null,
            decision: null
          });
        }

        // Assign content to user
        await storage.updateContentItem(contentId, {
          assignedTo: userId
        });

        // Refresh item data after assignment
        const updatedItem = await storage.getContentItemWithAssignedUser(contentId);
        return res.json(updatedItem);
      }

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
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Remove permission check temporarily to debug the data flow
      const items = await storage.getContentItemsWithAssignedUsers();
      res.json(items);
    } catch (error) {
      console.error("Error fetching content items:", error);
      res.status(500).json({ message: "Error fetching content items" });
    }
  });

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
      // Create content with proper metadata structure
      const newContent = await storage.createContentItem({
        content: req.body.content,
        type: req.body.type,
        priority: req.body.priority || 1,
        metadata: {
          originalMetadata: {},
          ...req.body.metadata
        }
      });

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

      // Check if a case already exists for this content and user
      const cases = await storage.getCases();

      const existingCase = cases.find(c =>
        c.contentId === data.contentId &&
        c.agentId === userId &&
        !c.decision // Only consider undecided cases
      );

      let caseToUpdate;
      if (existingCase) {
        caseToUpdate = existingCase;
      } else {
        // Create new case if none exists
        caseToUpdate = await storage.createCase(data);
      }

      // If decision is provided, update it immediately
      if (data.decision) {
        caseToUpdate = await storage.updateCase(caseToUpdate.id, {
          decision: data.decision,
          status: "closed",
          notes: data.notes
        });

        // Update content item status
        await storage.updateContentItem(data.contentId, {
          status: data.decision,
          assignedTo: null, // Release assignment after decision
        });
      } else {
        // If no decision, just assign the content
        await storage.updateContentItem(data.contentId, {
          assignedTo: userId,
        });
      }

      res.json(caseToUpdate);
    } catch (error) {
      console.error("Error handling case:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({
        message: "Invalid request",
        details: errorMessage
      });
    }
  });

  app.patch("/api/cases/decision", async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const user = await storage.getUser(userId);
      checkPermission(user.role, Permission.REVIEW_CONTENT);

      const data = decisionSchema.parse(req.body);

      // Additional check for review decisions
      if (data.decision === "review" && user.role === UserRole.AGENT) {
        return res.status(403).json({
          message: "Only Sr. Agents and above can send items for review"
        });
      }

      // Find or create case
      const cases = await storage.getCases();

      const existingCase = cases.find(c =>
        c.contentId === data.contentId &&
        c.agentId === userId &&
        !c.decision // Only consider undecided cases
      );

      let updatedCase;
      if (existingCase) {
        updatedCase = await storage.updateCase(existingCase.id, {
          decision: data.decision,
          status: "closed", // Ensure status is set to closed
          notes: data.notes
        });
      } else {
        // Create new case with decision
        updatedCase = await storage.createCase({
          contentId: data.contentId,
          agentId: userId,
          decision: data.decision,
          notes: data.notes || null,
          status: "closed" // Set status to closed for new cases with decisions
        });
      }

      // Update content item status to match the decision
      const contentStatus =
        data.decision === "approve" ? "approved" :
          data.decision === "reject" ? "rejected" :
            "pending"; // For review decision, keep it as pending

      await storage.updateContentItem(data.contentId, {
        status: contentStatus,
        assignedTo: data.decision === "review" ? null : null, // Release assignment after decision
      });

      res.json(updatedCase);
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error updating case decision:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: "Error updating case decision",
        details: errorMessage
      });
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
      const pendingCasesFromOthers = contentCases.filter(c =>
        c.decision === null && c.agentId !== userId
      );

      let errorMessage = "";

      // If there are pending cases from other moderators, block deletion
      if (pendingCasesFromOthers.length > 0) {
        errorMessage = "Content has pending moderation cases from other moderators";
      }

      // If content is being actively moderated by someone else, include moderator information
      if (item.status === "pending" && item.assignedTo && item.assignedTo !== userId) {
        const moderator = await storage.getUser(item.assignedTo);
        errorMessage = moderator
          ? `Content is currently being moderated by ${moderator.name}`
          : "Content is currently being moderated by another user";
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

  // Team Management Routes
  app.get("/api/teams", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      checkPermission(user.role, Permission.MANAGE_USERS);

      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      checkPermission(user.role, Permission.MANAGE_USERS);

      const team = await storage.createTeam(req.body);
      res.json(team);
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  // User Management Routes
  app.get("/api/users", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      checkPermission(user.role, Permission.MANAGE_USERS);

      const users = await storage.getUsers();
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const currentUser = await storage.getUser(userId);
      checkPermission(currentUser.role, Permission.MANAGE_USERS);

      const newUser = await storage.createUser(req.body);
      res.json({ ...newUser, password: undefined });
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  // Add this route after the existing user routes
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const currentUser = await storage.getUser(userId);
      checkPermission(currentUser.role, Permission.MANAGE_USERS);

      const targetUserId = parseInt(req.params.id);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const updatedUser = await storage.updateUser(targetUserId, req.body);
      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Add sample content creation endpoint for testing
  app.post("/api/content/test", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const testContent = await storage.createContentItem({
        content: "Test content for moderation",
        type: "text",
        priority: 1,
        metadata: {
          originalMetadata: {
            source: "Test"
          }
        }
      });

      res.json(testContent);
    } catch (error) {
      console.error("Error creating test content:", error);
      res.status(500).json({ message: "Error creating test content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}