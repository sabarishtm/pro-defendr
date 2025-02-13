import axios from "axios";
import FormData from "form-data";
import { ContentItem, ContentRegion, VideoOutput } from "@shared/schema";
import { existsSync, statSync, readFileSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import { storage } from "../storage";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";

interface ModerationResult {
  status: ContentItem["status"];
  regions: ContentRegion[];
  aiConfidence: Record<string, number>;
  output?: VideoOutput[];
}

export class ModerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Ensure thumbnails directory exists
    const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    if (!existsSync(thumbnailsDir)) {
      mkdirSync(thumbnailsDir, { recursive: true });
    }
  }

  private async generateThumbnail(videoPath: string, timeInSeconds: number, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`Generating thumbnail at ${timeInSeconds}s for video: ${videoPath}`);
      console.log(`Output path: ${outputPath}`);

      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => {
          console.log(`Successfully generated thumbnail at ${timeInSeconds}s:`, outputPath);
          const publicPath = `/uploads/thumbnails/${path.basename(outputPath)}`;
          console.log(`Public URL for thumbnail: ${publicPath}`);
          resolve(publicPath);
        })
        .on('error', (err) => {
          console.error(`Error generating thumbnail at ${timeInSeconds}s:`, err);
          reject(err);
        });
    });
  }

  private async getActiveService(): Promise<"openai" | "thehive"> {
    try {
      const settings = await storage.getSettings();
      const moderationSetting = settings.find(s => s.key === "moderation_service");
      return (moderationSetting?.value === "thehive") ? "thehive" : "openai";
    } catch (error) {
      console.error("Error getting moderation service setting:", error);
      return "openai"; // Default to OpenAI if setting can't be retrieved
    }
  }

  private async moderateTextWithOpenAI(text: string): Promise<ModerationResult> {
    try {
      const response = await this.openai.moderations.create({ input: text });
      const result = response.results[0];

      const scores: Record<string, number> = {};
      Object.entries(result.category_scores).forEach(([category, score]) => {
        if (score > 0.01) { // Only include meaningful scores
          scores[category.replace(/_/g, ' ')] = score;
        }
      });

      return {
        status: result.flagged ? "rejected" : "approved",
        regions: [],
        aiConfidence: scores,
      };
    } catch (error) {
      console.error("OpenAI moderation error:", error);
      return {
        status: "flagged",
        regions: [],
        aiConfidence: { "api_error": 1.0 },
      };
    }
  }

  private async moderateTextWithHive(text: string): Promise<ModerationResult> {
    console.log("Moderating text content with TheHive...");

    try {
      const formData = new FormData();
      formData.append("text_data", text);

      console.log("Making API request to TheHive for text moderation...");
      const response = await axios.post(
        'https://api.thehive.ai/api/v2/task/sync',
        formData,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Token ${process.env.THEHIVE_API_KEY}`,
            ...formData.getHeaders()
          }
        }
      );

      console.log("TheHive API Response for text:", JSON.stringify(response.data, null, 2));

      const result = response.data.status[0].response;
      const scores: Record<string, number> = {};

      // Process text filters (profanity, etc.)
      if (result.text_filters && result.text_filters.length > 0) {
        const filterCounts: Record<string, number> = {};
        result.text_filters.forEach((filter: { type: string; value: string }) => {
          filterCounts[filter.type] = (filterCounts[filter.type] || 0) + 1;
        });

        Object.entries(filterCounts).forEach(([type, count]) => {
          scores[`${type}`] = count;
        });
      }

      // Process class-based scores
      const classes = result.output[0].classes;
      classes.forEach((item: { class: string; score: number }) => {
        if (item.score <= 0 || item.class.startsWith('no_')) return;

        const cleanName = item.class
          .replace(/^yes_/, '')
          .replace(/_/g, ' ');

        scores[cleanName] = item.score;
      });

      const hasHighRiskContent = Object.entries(scores).some(([key, value]) =>
        (key === 'profanity' && value > 0) || value > 2
      );
      const status = hasHighRiskContent ? "rejected" : "approved";

      return {
        status,
        regions: [],
        aiConfidence: scores,
      };
    } catch (error) {
      console.error("TheHive API error for text:", error);
      if (axios.isAxiosError(error)) {
        console.error("API Response:", error.response?.data);
      }
      return {
        status: "flagged",
        regions: [],
        aiConfidence: { "api_error": 1.0 },
      };
    }
  }

  private async moderateImage(filePath: string): Promise<ModerationResult> {
    try {
      const formData = new FormData();
      formData.append("image", readFileSync(filePath), {
        filename: path.basename(filePath),
        contentType: 'image/jpeg'
      });

      const apiKey = process.env.THEHIVE_API_KEY?.startsWith('token ')
        ? process.env.THEHIVE_API_KEY
        : `token ${process.env.THEHIVE_API_KEY}`;

      console.log("Making API request to TheHive for image/video moderation...");
      const response = await axios.post(
        'https://api.thehive.ai/api/v2/task/sync',
        formData,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': apiKey,
            ...formData.getHeaders()
          }
        }
      );

      console.log("Complete TheHive API Response:", JSON.stringify(response.data, null, 2));

      const videoOutput: VideoOutput[] = [];
      try {
        // Get video duration using ffprobe
        const ffprobeProcess = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          filePath
        ]);

        let duration = 0;
        let ffprobeOutput = '';

        await new Promise<void>((resolve, reject) => {
          ffprobeProcess.stdout.on('data', (data) => {
            ffprobeOutput += data.toString();
          });

          ffprobeProcess.on('close', (code) => {
            if (code === 0) {
              duration = parseFloat(ffprobeOutput.trim());
              console.log("Video duration:", duration, "seconds");
              resolve();
            } else {
              console.error("ffprobe failed with code:", code);
              reject(new Error(`ffprobe failed with code ${code}`));
            }
          });
        });

        const timelineData = response.data.status[0].response.timeline || [];
        const defaultInterval = Math.max(1, Math.floor(duration / 10)); // Ensure at least 1 second interval

        // If timeline data exists, use it directly
        if (timelineData.length > 0) {
          console.log("Using timeline data from API:", timelineData.length, "entries");

          // Sort timeline data by time
          timelineData.sort((a: any, b: any) => {
            const timeA = typeof a.time === 'number' ? a.time : parseFloat(a.time);
            const timeB = typeof b.time === 'number' ? b.time : parseFloat(b.time);
            return timeA - timeB;
          });

          // Process each timeline entry
          for (const frame of timelineData) {
            const confidence: Record<string, number> = {};
            const time = typeof frame.time === 'number' ? frame.time : parseFloat(frame.time);

            if (Array.isArray(frame.classes)) {
              frame.classes.forEach((cls: { class: string; score: number }) => {
                if (!cls.class.startsWith('no_') && cls.score > 0) {
                  const key = cls.class.replace(/^yes_/, '').replace(/_/g, ' ');
                  confidence[key] = cls.score;
                }
              });
            }

            if (time <= duration) { // Only include timestamps within video duration
              videoOutput.push({ time, confidence });
            }
          }
        } else {
          // If no timeline data, generate evenly spaced timestamps
          console.log("No timeline data, generating timestamps with interval:", defaultInterval);
          for (let time = 0; time <= duration; time += defaultInterval) {
            const confidence: Record<string, number> = {};

            // Use general confidence scores from the API response
            const baseClasses = response.data.status[0].response.output[0].classes;
            baseClasses.forEach((cls: { class: string; score: number }) => {
              if (!cls.class.startsWith('no_') && cls.score > 0) {
                const key = cls.class.replace(/^yes_/, '').replace(/_/g, ' ');
                confidence[key] = cls.score;
              }
            });

            videoOutput.push({ time, confidence });
          }

          // Always include the last frame if it's not already included
          const lastTime = Math.floor(duration);
          if (lastTime > videoOutput[videoOutput.length - 1].time) {
            videoOutput.push({
              time: lastTime,
              confidence: { ...videoOutput[videoOutput.length - 1].confidence }
            });
          }
        }

        console.log("Final processed video output:", {
          numberOfFrames: videoOutput.length,
          firstFrame: videoOutput[0],
          lastFrame: videoOutput[videoOutput.length - 1],
          duration
        });

      } catch (e) {
        console.error("Error processing timeline data:", e);
        if (e instanceof Error) {
          console.error("Error details:", {
            message: e.message,
            stack: e.stack,
          });
        }
      }

      // Process overall confidence scores
      const result = response.data.status[0].response.output[0].classes;
      const scores: Record<string, number> = {};

      result.forEach((item: { class: string; score: number }) => {
        if (item.score <= 0 || item.class.startsWith('no_')) return;
        const cleanName = item.class
          .replace(/^yes_/, '')
          .replace(/_/g, ' ');
        if (item.score > 0.001) {
          scores[cleanName] = item.score;
        }
      });

      const maxScore = Math.max(0, ...Object.values(scores));
      const status = maxScore > 0.8 ? "rejected" : maxScore > 0.4 ? "flagged" : "approved";

      return {
        status,
        regions: [],
        aiConfidence: scores,
        output: videoOutput.length > 0 ? videoOutput : undefined,
      };
    } catch (error) {
      console.error("TheHive API error:", error);
      if (axios.isAxiosError(error)) {
        console.error("API Response:", error.response?.data);
      }
      return {
        status: "flagged",
        regions: [],
        aiConfidence: { "api_error": 1.0 },
        output: undefined
      };
    }
  }

  private async moderateMediaWithOpenAI(filePath: string): Promise<ModerationResult> {
    // OpenAI doesn't support direct media moderation yet
    // Return a default response indicating unsupported media type
    return {
      status: "flagged",
      regions: [],
      aiConfidence: { "unsupported_media_type": 1.0 },
      output: undefined
    };
  }

  public async moderateContent(content: ContentItem): Promise<ModerationResult> {
    try {
      console.log("Starting content moderation for:", content.id);
      const service = await this.getActiveService();
      console.log("Using moderation service:", service);

      const filePath = path.join(process.cwd(), content.content);
      console.log("Using file path:", filePath);

      if (content.type === 'text') {
        const textContent = content.content;
        return service === "thehive"
          ? await this.moderateTextWithHive(textContent)
          : await this.moderateTextWithOpenAI(textContent);
      } else if (content.type === 'image' || content.type === 'video') {
        // For media content, verify file exists and is not empty
        if (!existsSync(filePath)) {
          throw new Error(`File does not exist: ${filePath}`);
        }

        const fileStats = statSync(filePath);
        if (fileStats.size === 0) {
          throw new Error("File is empty");
        }

        return await this.moderateImage(filePath); // Use the new moderateImage function
      }

      throw new Error(`Unsupported content type: ${content.type}`);
    } catch (error) {
      console.error("Content moderation failed:", error);
      return {
        status: "flagged",
        regions: [],
        aiConfidence: { "error": 1.0 },
      };
    }
  }
}

export const moderationService = new ModerationService();