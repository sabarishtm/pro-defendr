import { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { loginSchema, insertCaseSchema, decisionSchema, Permission, UserRole, settings } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import { checkPermission, PermissionError } from "./utils/permissions";
import { moderationService } from "./services/moderation";

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

  // Initialize default settings if they don't exist
  (async () => {
    try {
      const settings = await storage.getSettings();
      const moderationSetting = settings.find(s => s.key === "moderation_service");

      if (!moderationSetting) {
        await storage.updateSetting("moderation_service", "openai");
        console.log("Initialized default moderation service setting to OpenAI");
      }
    } catch (error) {
      console.error("Error initializing settings:", error);
    }
  })();

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

  // Update the content analysis in the /api/content/next route
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
        const moderationResult = await moderationService.moderateContent(nextItem);
        const analysis = {
          classification: {
            category: nextItem.type,
            confidence: Object.values(moderationResult.aiConfidence)[0] || 0,
            suggestedAction: (moderationResult.status === "approved" ? "approve" as const :
                              moderationResult.status === "rejected" ? "reject" as const :
                              "review" as const),
          },
          contentFlags: Object.entries(moderationResult.aiConfidence).map(([type, severity]) => ({
            type,
            severity: severity * 10,
            details: `Content contains ${type} with confidence ${severity}`,
          })),
          riskScore: Math.max(...Object.values(moderationResult.aiConfidence), 0),
          regions: moderationResult.regions,
          timeline: moderationResult.output,
        };

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
        },
        status: "pending" // Add default status
      });

      // Run moderation analysis using TheHive service
      const moderationResult = await moderationService.moderateContent(newContent);
      const analysis = {
        classification: {
          category: newContent.type,
          confidence: Object.values(moderationResult.aiConfidence)[0] || 0,
          suggestedAction: moderationResult.status === "approved" ? "approve" as const :
                            moderationResult.status === "rejected" ? "reject" as const : "review" as const,
        },
        contentFlags: Object.entries(moderationResult.aiConfidence).map(([type, severity]) => ({
          type,
          severity: severity * 10, // Convert to 0-10 scale
          details: `Content contains ${type} with confidence ${severity}`,
        })),
        riskScore: Math.max(...Object.values(moderationResult.aiConfidence), 0),
        regions: moderationResult.regions,
        timeline: moderationResult.output,
      };

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

  // Update file upload route to use moderation service
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
        },
        status: "pending" // Add status
      });

      // Run moderation analysis on the new content
      const moderationResult = await moderationService.moderateContent(newContent);
      const analysis = {
        classification: {
          category: fileType,
          confidence: Object.values(moderationResult.aiConfidence)[0] || 0,
          suggestedAction: moderationResult.status === "approved" ? "approve" :
                             moderationResult.status === "rejected" ? "reject" : "review",
        },
        contentFlags: Object.entries(moderationResult.aiConfidence).map(([type, severity]) => ({
          type,
          severity: severity * 10, // Convert to 0-10 scale
          details: `Content contains ${type} with confidence ${severity}`,
        })),
        riskScore: Math.max(...Object.values(moderationResult.aiConfidence), 0),
        regions: moderationResult.regions,
        timeline: moderationResult.output,
      };

      // Update the content with moderation analysis
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

  // Helper function to delete media files and thumbnails
  async function cleanupMediaFiles(content: any) {
    if (!content.content.startsWith('/uploads/')) {
      return; // Not a file-based content
    }

    const basePath = path.join(process.cwd());

    // Delete main media file
    const filePath = path.join(basePath, content.content.slice(1));
    try {
      await fs.promises.unlink(filePath);
      console.log(`Deleted main file: ${filePath}`);
    } catch (error) {
      console.error(`Error deleting main file ${filePath}:`, error);
    }

    // Delete thumbnails if they exist
    // First check in the metadata.aiAnalysis.timeline for thumbnails
    if (content.metadata?.aiAnalysis?.timeline) {
      try {
        const timeline = content.metadata.aiAnalysis.timeline;
        for (const frame of timeline) {
          if (frame.thumbnail && frame.thumbnail.startsWith('/uploads/')) {
            const thumbnailPath = path.join(basePath, frame.thumbnail.slice(1));
            try {
              await fs.promises.unlink(thumbnailPath);
              console.log(`Deleted timeline thumbnail: ${thumbnailPath}`);
            } catch (error) {
              console.error(`Error deleting timeline thumbnail ${thumbnailPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error cleaning up timeline thumbnails:", error);
      }
    }

    // Also check legacy videoThumbnails field
    if (content.metadata?.videoThumbnails) {
      try {
        const thumbnails = JSON.parse(content.metadata.videoThumbnails as string);
        for (const thumbnail of thumbnails) {
          if (typeof thumbnail === 'string' && thumbnail.startsWith('/uploads/')) {
            const thumbnailPath = path.join(basePath, thumbnail.slice(1));
            try {
              await fs.promises.unlink(thumbnailPath);
              console.log(`Deleted thumbnail: ${thumbnailPath}`);
            } catch (error) {
              console.error(`Error deleting thumbnail ${thumbnailPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing video thumbnails:", error);
      }
    }

    // Cleanup the thumbnails directory if it exists
    const thumbnailsDir = path.join(basePath, 'uploads', 'thumbnails');
    try {
      const files = await fs.promises.readdir(thumbnailsDir);
      for (const file of files) {
        if (file.startsWith('thumb_')) {
          const thumbnailPath = path.join(thumbnailsDir, file);
          try {
            await fs.promises.unlink(thumbnailPath);
            console.log(`Deleted thumbnail from directory: ${thumbnailPath}`);
          } catch (error) {
            console.error(`Error deleting thumbnail ${thumbnailPath}:`, error);
          }
        }
      }
    } catch (error) {
      // Ignore if thumbnails directory doesn't exist
      if (error.code !== 'ENOENT') {
        console.error("Error cleaning thumbnails directory:", error);
      }
    }
  }

  app.delete("/api/content/:id", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Get content and user info
      const content = await storage.getContentItem(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only check for pending cases if user is not an admin
      if (user.role !== "admin") {
        // Check for existing cases
        const cases = await storage.getCases();
        const contentCases = cases.filter(c => c.contentId === contentId);
        const pendingCasesFromOthers = contentCases.filter(c =>
          c.decision === null && c.agentId !== userId
        );

        // If there are pending cases from other moderators, block deletion
        if (pendingCasesFromOthers.length > 0) {
          return res.status(400).json({
            message: "Content has pending moderation cases from other moderators"
          });
        }

        // If content is being actively moderated by someone else, include moderator information
        if (content.status === "pending" && content.assignedTo && content.assignedTo !== userId) {
          const moderator = await storage.getUser(content.assignedTo);
          const errorMessage = moderator
            ? `Content is currently being moderated by ${moderator.name}`
            : "Content is currently being moderated by another user";
          return res.status(400).json({ message: errorMessage });
        }
      }

      // Clean up all associated files
      await cleanupMediaFiles(content);

      // Delete from database
      await storage.deleteContentItem(contentId);
      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Error deleting content" });
    }
  });

  app.post("/api/content/bulk-delete", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Invalid request: ids must be an array" });
      }

      const results = {
        success: [] as number[],
        failed: [] as { id: number; reason: string }[]
      };

      for (const id of ids) {
        try {
          const content = await storage.getContentItem(id);
          if (!content) {
            results.failed.push({ id, reason: "Content not found" });
            continue;
          }

          // Check if content is being moderated
          if (content.status === "pending" && content.assignedTo && content.assignedTo !== userId) {
            const moderator = await storage.getUser(content.assignedTo);
            results.failed.push({
              id,
              reason: moderator
                ? `Currently being moderated by ${moderator.name}`
                : "Currently being moderated by another user"
            });
            continue;
          }

          // Clean up all associated files
          await cleanupMediaFiles(content);

          // Delete from database
          await storage.deleteContentItem(id);
          results.success.push(id);
        } catch (error) {
          console.error(`Error deleting content ${id}:`, error);
          results.failed.push({
            id,
            reason: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      res.status(200).json({
        message: "Bulk delete operation completed",
        results
      });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Internal server error" });
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
        },
        status: "pending" // Add status
      });

      res.json(testContent);
    } catch (error) {
      console.error("Error creating test content:", error);
      res.status(500).json({ message: "Error creating test content" });
    }
  });

  app.get("/api/settings", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      checkPermission(user.role, Permission.MANAGE_SETTINGS);

      const settingsData = await storage.getSettings();
      res.json(settingsData);
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      checkPermission(user.role, Permission.MANAGE_SETTINGS);

      const { key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ message: "Missing key or value" });
      }

      const updatedSettings = await storage.updateSetting(key, value);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof PermissionError) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Add this route before the server export
  app.get("/api/stats", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const allContent = await storage.getContentItems();
      const cases = await storage.getCases();

      console.log("Fetched cases:", cases.length);

      // Calculate statistics
      const total = allContent.length;
      const completedCases = cases.filter(c => c.decision);
      const avgProcessingTime = completedCases.length ?
        completedCases.reduce((acc, c) => {
          const creationTime = new Date(c.createdAt).getTime();
          const completionTime = creationTime + (24 * 60 * 60 * 1000); // Assuming 24h for now as we don't store completion time
          return acc + (completionTime - creationTime);
        }, 0) / completedCases.length :
        0;

      // Calculate AI accuracy by comparing AI suggestions with moderator decisions
      let correctPredictions = 0;
      let totalPredictions = 0;

      for (const content of allContent) {
        const aiSuggestion = content.metadata.aiAnalysis?.classification.suggestedAction;
        const case_ = cases.find(c => c.contentId === content.id && c.decision);

        if (aiSuggestion && case_) {
          totalPredictions++;
          if (
            (aiSuggestion === 'approve' && case_.decision === 'approved') ||
            (aiSuggestion === 'reject' && case_.decision === 'rejected')
          ) {
            correctPredictions++;
          }
        }
      }

      const aiAccuracy = totalPredictions ? correctPredictions / totalPredictions : 0;
      const flaggedContent = allContent.filter(item =>
        item.metadata.aiAnalysis?.contentFlags.some(flag => flag.severity > 7)
      );
      const flaggedContentRatio = total ? flaggedContent.length / total : 0;

      // Generate moderation trends (last 7 days)
      const moderationTrends = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const daysCases = cases.filter(c => {
          const caseDate = new Date(c.createdAt);
          return caseDate.getFullYear() === date.getFullYear() &&
                 caseDate.getMonth() === date.getMonth() &&
                 caseDate.getDate() === date.getDate() &&
                 c.decision;
        });

        return {
          date: date.toISOString().split('T')[0],
          approved: daysCases.filter(c => c.decision === 'approved').length,
          rejected: daysCases.filter(c => c.decision === 'rejected').length,
          flagged: daysCases.filter(c => c.decision === 'review').length,
        };
      }).reverse();

      // Calculate content type distribution
      const contentTypeStats = allContent.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = { count: 0, totalTime: 0 };
        }
        acc[item.type].count++;

        const itemCase = cases.find(c => c.contentId === item.id && c.decision);
        if (itemCase) {
          const creationTime = new Date(itemCase.createdAt).getTime();
          const completionTime = creationTime + (24 * 60 * 60 * 1000); // Assuming 24h for now
          acc[item.type].totalTime += (completionTime - creationTime);
        }

        return acc;
      }, {} as Record<string, { count: number; totalTime: number; }>);

      const contentTypeDistribution = Object.entries(contentTypeStats).map(([type, stats]) => ({
        type,
        avgProcessingTime: stats.count ? stats.totalTime / stats.count : 0,
        count: stats.count,
      }));

      const response = {
        total,
        avgProcessingTime,
        aiAccuracy,
        flaggedContentRatio,
        moderationTrends,
        contentTypeDistribution,
      };

      console.log("Stats response:", response);
      res.json(response);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Error fetching statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}