import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import express from "express";
import { moderationService } from "./services/moderation";
import { spawn } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";

// Configure multer for file uploads with size limits
const uploadsDir = path.join(process.cwd(), "uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('video/') ||
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Create uploads directory if it doesn't exist
fs.mkdir(uploadsDir, { recursive: true }).catch((error) => {
  console.error("Error creating uploads directory:", error);
});

export function registerRoutes(app: Express): Server {
  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Serve uploaded files statically with proper MIME types
  app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res, filepath) => {
      // Set proper content type based on file extension
      if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg')) {
        res.set('Content-Type', 'image/jpeg');
      } else if (filepath.endsWith('.png')) {
        res.set('Content-Type', 'image/png');
      } else if (filepath.endsWith('.gif')) {
        res.set('Content-Type', 'image/gif');
      } else if (filepath.endsWith('.mp4')) {
        res.set('Content-Type', 'video/mp4');
      } else if (filepath.endsWith('.webm')) {
        res.set('Content-Type', 'video/webm');
      }
    }
  }));

  app.get("/api/content", async (_req, res) => {
    const content = await storage.getAllContent();
    res.json(content);
  });

  app.get("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    const content = await storage.getContent(id);
    if (!content) {
      res.status(404).json({ message: "Content not found" });
      return;
    }

    res.json(content);
  });

  app.post("/api/content", async (req, res) => {
    const parseResult = insertContentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ message: "Invalid content data" });
      return;
    }

    const content = await storage.createContent(parseResult.data);
    res.json(content);
  });

  app.patch("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    const content = await storage.updateContent(id, req.body);
    if (!content) {
      res.status(404).json({ message: "Content not found" });
      return;
    }

    res.json(content);
  });

  app.get("/api/stats", async (_req, res) => {
    const stats = await storage.getQueueStats();
    res.json(stats);
  });

  app.post("/api/admin/upload", upload.single("file"), async (req: Request & { file?: Express.Multer.File }, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const title = req.body.title;
      const type = req.body.type;
      const filePath = req.file.path;

      // Create a web-accessible URL for the uploaded file
      const fileUrl = `/uploads/${path.basename(filePath)}`;

      // Prepare content data
      const contentData = {
        title,
        type,
        url: fileUrl,
      };

      // Validate content data
      const parseResult = insertContentSchema.safeParse(contentData);
      if (!parseResult.success) {
        await fs.unlink(filePath);
        res.status(400).json({ message: "Invalid content data" });
        return;
      }

      // Create initial content entry
      const content = await storage.createContent(parseResult.data);

      try {
        // Process with TheHive AI
        const moderationResult = await moderationService.moderateContent(content, filePath);
        console.log("Moderation result:", JSON.stringify(moderationResult, null, 2));

        // Generate thumbnails for video content
        let thumbnails: string[] = [];
        if (type === 'video' && moderationResult.output && moderationResult.output.length > 0) {
          try {
            console.log("Starting thumbnail generation for video:", filePath);
            const videoOutput = moderationResult.output;
            console.log("Video timestamps from AI:", JSON.stringify(videoOutput, null, 2));

            // Create thumbnails directory if it doesn't exist
            const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
            await fs.mkdir(thumbnailsDir, { recursive: true });

            // Extract frames at timestamps using ffmpeg
            for (const output of videoOutput) {
              const timestamp = output.time;
              const thumbnailFilename = `thumb_${uuidv4()}.jpg`;
              const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

              console.log(`Generating thumbnail at timestamp ${timestamp}s -> ${thumbnailPath}`);

              try {
                // Use ffmpeg to extract frame at specific timestamp
                await new Promise<void>((resolve, reject) => {
                  const ffmpegCmd = [
                    '-ss', timestamp.toString(),
                    '-i', filePath,
                    '-vframes', '1',
                    '-q:v', '2',
                    thumbnailPath
                  ];
                  console.log("Running ffmpeg command:", ffmpegCmd.join(' '));

                  const ffmpeg = spawn('ffmpeg', ffmpegCmd);

                  let stdoutData = '';
                  let stderrData = '';

                  ffmpeg.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                    console.log("ffmpeg stdout:", data.toString());
                  });

                  ffmpeg.stderr.on('data', (data) => {
                    stderrData += data.toString();
                    console.log("ffmpeg stderr:", data.toString());
                  });

                  ffmpeg.on('close', (code) => {
                    if (code === 0) {
                      console.log(`Successfully generated thumbnail: ${thumbnailPath}`);
                      thumbnails.push(`/uploads/thumbnails/${thumbnailFilename}`);
                      resolve();
                    } else {
                      console.error(`FFmpeg failed with code ${code}`);
                      console.error('stdout:', stdoutData);
                      console.error('stderr:', stderrData);
                      reject(new Error(`FFmpeg exited with code ${code}`));
                    }
                  });

                  ffmpeg.on('error', (error) => {
                    console.error("FFmpeg process error:", error);
                    reject(error);
                  });
                });
              } catch (error) {
                console.error(`Error generating thumbnail at ${timestamp}:`, error);
              }
            }
            console.log("Generated thumbnails:", thumbnails);
          } catch (error) {
            console.error("Error in thumbnail generation:", error);
            if (error instanceof Error) {
              console.error("Error details:", error.message);
              console.error("Error stack:", error.stack);
            }
          }
        } else {
          console.log("Skipping thumbnail generation:", {
            isVideo: type === 'video',
            hasOutput: Boolean(moderationResult.output),
            outputLength: moderationResult.output?.length
          });
        }

        // Update content with moderation results and thumbnails
        console.log("Storing thumbnails in database:", thumbnails);
        const updatedContent = await storage.updateContent(content.id, {
          status: moderationResult.status,
          offensiveRegions: JSON.stringify(moderationResult.regions),
          aiConfidence: JSON.stringify(moderationResult.aiConfidence),
          aiOutput: JSON.stringify(moderationResult.output || []),
          videoThumbnails: JSON.stringify(thumbnails),
          aiDecision: moderationResult.status,
        });

        console.log("Updated content with thumbnails:", {
          contentId: updatedContent?.id,
          thumbnails: updatedContent?.videoThumbnails,
          aiOutput: updatedContent?.aiOutput
        });

        res.status(201).json(updatedContent);
      } catch (error) {
        console.error("Content moderation failed:", error);
        // Return the content even if moderation fails
        res.status(201).json(content);
      }
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/content/:id/feedback", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    const { isCorrect, notes } = req.body;
    if (typeof isCorrect !== "boolean") {
      res.status(400).json({ message: "isCorrect must be a boolean" });
      return;
    }

    try {
      const content = await storage.submitAIFeedback(id, isCorrect, notes);
      res.json(content);
    } catch (error) {
      console.error("Error submitting AI feedback:", error);
      res.status(500).json({ message: "Error submitting feedback" });
    }
  });

  app.delete("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    try {
      // Get content before deletion to get file path
      const content = await storage.getContent(id);
      if (!content) {
        res.status(404).json({ message: "Content not found" });
        return;
      }

      // Delete from database
      await storage.deleteContent(id);

      // Delete file from filesystem
      const filePath = path.join(process.cwd(), content.url.slice(1)); // Remove leading slash
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error("Error deleting file:", error);
        // Don't fail if file is already gone
      }

      res.status(200).json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/content/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        res.status(400).json({ message: "Invalid request: ids must be an array" });
        return;
      }

      for (const id of ids) {
        // Get content before deletion to get file path
        const content = await storage.getContent(id);
        if (content) {
          // Delete from database
          await storage.deleteContent(id);

          // Delete file from filesystem
          const filePath = path.join(process.cwd(), content.url.slice(1)); // Remove leading slash
          try {
            await fs.unlink(filePath);
          } catch (error) {
            console.error(`Error deleting file for content ${id}:`, error);
            // Continue with next item even if file deletion fails
          }
        }
      }

      res.status(200).json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}