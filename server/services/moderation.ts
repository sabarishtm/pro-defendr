import axios from "axios";
import FormData from "form-data";
import { ContentItem, ContentRegion, VideoOutput } from "@shared/schema";
import { existsSync, statSync, readFileSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import { storage } from "../storage";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";

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
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => {
          console.log(`Generated thumbnail at ${timeInSeconds}s:`, outputPath);
          resolve(outputPath);
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

  private async moderateMediaWithHive(filePath: string): Promise<ModerationResult> {
    try {
      console.log("Current working directory:", process.cwd());
      const fileName = path.basename(filePath);
      console.log("File name extracted:", fileName);

      const baseUrl = 'https://90a7bc36-1960-416f-8911-a669ed15767d-00-f6vtlt7qb0g1.riker.replit.dev';
      const publicUrl = `${baseUrl}/uploads/${fileName}`;
      console.log("Constructed public URL:", publicUrl);

      const response = await axios.post(
        'https://api.thehive.ai/api/v2/task/sync',
        { url: publicUrl },
        {
          headers: {
            'accept': 'application/json',
            'authorization': 'token rvi3tYbKFoj7Ww5aTnPTNpCE29wXQQVJ'
          }
        }
      );

      console.log("API Response structure:", {
        hasStatus: !!response.data.status,
        responseLength: response.data.status?.length,
        firstResponseStatus: response.data.status?.[0]?.status,
        hasTimeline: !!response.data.status?.[0]?.response?.timeline,
        timelineLength: response.data.status?.[0]?.response?.timeline?.length,
        outputLength: response.data.status?.[0]?.response?.output?.length,
        firstOutputClasses: response.data.status?.[0]?.response?.output?.[0]?.classes?.length
      });

      const result = response.data.status[0].response;
      const scores: Record<string, number> = {};

      if (result.output && result.output[0] && result.output[0].classes) {
        result.output[0].classes.forEach((item: { class: string; score: number }) => {
          if (item.score <= 0 || item.class.startsWith('no_')) return;
          const cleanName = item.class.replace(/^yes_/, '').replace(/_/g, ' ');
          if (item.score > 0.001) {
            scores[cleanName] = item.score;
          }
        });
      }

      // Generate thumbnails and construct timeline data
      const timeline = await Promise.all(result.output?.map(async (frame: any, index: number) => {
        const frameScores: Record<string, number> = {};
        const timeInSeconds = index / 30; // Assuming 30fps

        if (frame.classes) {
          frame.classes.forEach((item: { class: string; score: number }) => {
            if (item.score <= 0 || item.class.startsWith('no_')) return;
            const cleanName = item.class.replace(/^yes_/, '').replace(/_/g, ' ');
            if (item.score > 0.001) {
              frameScores[cleanName] = item.score;
            }
          });
        }

        // Generate thumbnail for this frame
        const thumbnailPath = path.join('uploads', 'thumbnails', `${path.parse(fileName).name}_${index}.jpg`);
        let thumbnailUrl;
        try {
          await this.generateThumbnail(filePath, timeInSeconds, thumbnailPath);
          thumbnailUrl = `/uploads/thumbnails/${path.basename(thumbnailPath)}`;
          console.log(`Generated thumbnail for frame ${index}:`, thumbnailUrl);
        } catch (err) {
          console.error(`Failed to generate thumbnail for frame ${index}:`, err);
          thumbnailUrl = null;
        }

        return {
          time: timeInSeconds,
          confidence: frameScores,
          thumbnail: thumbnailUrl
        };
      }) || []);

      console.log("Final processed confidence scores:", scores);
      console.log("Timeline data being returned:", timeline);

      const maxScore = Math.max(0, ...Object.values(scores));
      const status = maxScore > 0.8 ? "rejected" : maxScore > 0.4 ? "flagged" : "approved";

      const regions: ContentRegion[] = Object.entries(scores)
        .filter(([_, score]) => score > 0.2)
        .map(([type, confidence]) => ({
          type,
          confidence,
          x: 0,
          y: 0,
          width: 100,
          height: 100
        }));

      return {
        status,
        regions,
        aiConfidence: scores,
        output: timeline
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

        return service === "thehive"
          ? await this.moderateMediaWithHive(filePath)
          : await this.moderateMediaWithOpenAI(filePath);
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