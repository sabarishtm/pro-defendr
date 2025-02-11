import axios from "axios";
import { Content } from "@shared/schema";
import { existsSync, statSync, readFileSync } from "fs";
import path from "path";
import FormData from "form-data";
import { spawn } from "child_process";

export interface ContentRegion {
  type: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VideoOutput {
  time: number;
  confidence: Record<string, number>;
}

interface ModerationResult {
  status: Content["status"];
  regions: ContentRegion[];
  aiConfidence: Record<string, number>;
  output?: VideoOutput[];
}

export class ModerationService {
  private async moderateText(text: string): Promise<ModerationResult> {
    console.log("Moderating text content...");

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
            'Authorization': 'token syxvn72cDaGOaNuCzf8LFsBABMMoo7jk',
            ...formData.getHeaders()
          }
        }
      );

      console.log("TheHive API Response for text:", JSON.stringify(response.data, null, 2));

      const result = response.data.status[0].response;
      const scores: Record<string, number> = {};

      // Process text filters (profanity, etc.)
      if (result.text_filters && result.text_filters.length > 0) {
        // Count occurrences of each filter type
        const filterCounts: Record<string, number> = {};
        result.text_filters.forEach((filter: { type: string; value: string }) => {
          filterCounts[filter.type] = (filterCounts[filter.type] || 0) + 1;
        });

        // Add filter counts directly to scores
        Object.entries(filterCounts).forEach(([type, count]) => {
          scores[`${type}`] = count; // Use actual count, not a percentage
        });
      }

      // Process class-based scores
      const classes = result.output[0].classes;
      classes.forEach((item: { class: string; score: number }) => {
        // Skip classes with score <= 0
        if (item.score <= 0) return;

        // Skip any classes with "no_" prefix
        if (item.class.startsWith('no_')) return;

        // Clean up the class name
        const cleanName = item.class
          .replace(/^yes_/, '') // Remove yes_ prefix
          .replace(/_/g, ' '); // Replace underscores with spaces

        // Use the raw score as it represents count for text processing
        scores[cleanName] = item.score;
      });

      console.log("Processed confidence scores:", scores);

      // For text moderation, if any profanity or high-risk content is detected, flag or reject
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
        console.error("Request Config:", {
          url: error.config?.url,
          headers: {
            ...error.config?.headers,
            'Authorization': 'token [REDACTED]' // Log sanitized version
          },
          method: error.config?.method
        });
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
      // Create form data
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

      // Log the complete API response structure
      console.log("Complete TheHive API Response:", JSON.stringify(response.data, null, 2));
      console.log("API Response structure:", {
        hasStatus: !!response.data.status,
        responseLength: response.data.status?.length,
        firstResponseStatus: response.data.status?.[0]?.status,
        hasTimeline: !!response.data.status?.[0]?.response?.timeline,
        timelineLength: response.data.status?.[0]?.response?.timeline?.length,
        outputLength: response.data.status?.[0]?.response?.output?.length,
        firstOutputClasses: response.data.status?.[0]?.response?.output?.[0]?.classes?.length
      });

      const videoOutput: VideoOutput[] = [];
      try {
        // Get video duration using ffmpeg
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

        // Process timeline data from API response
        const timelineData = response.data.status[0].response.timeline;
        console.log("Raw timeline data:", JSON.stringify(timelineData, null, 2));

        if (timelineData && Array.isArray(timelineData)) {
          console.log("Processing API timeline data, found entries:", timelineData.length);

          for (const frame of timelineData) {
            console.log("Processing frame:", frame);
            const confidence: Record<string, number> = {};

            // Process frame-specific classes if available
            if (Array.isArray(frame.classes)) {
              console.log("Processing frame classes:", frame.classes.length, "entries");
              frame.classes.forEach((cls: { class: string; score: number }) => {
                // Only include positive scores and non-negated classes
                if (!cls.class.startsWith('no_') && cls.score > 0) {
                  const key = cls.class.replace(/^yes_/, '').replace(/_/g, ' ');
                  confidence[key] = cls.score;
                  console.log(`Added confidence score: ${key} = ${cls.score}`);
                }
              });
            }

            // Convert time field to number if it exists
            const time = typeof frame.time === 'number' ? frame.time :
                        typeof frame.time === 'string' ? parseFloat(frame.time) : 0;

            console.log(`Adding timestamp entry: time=${time}, confidence keys=${Object.keys(confidence).length}`);
            videoOutput.push({
              time,
              confidence,
            });
          }
        } else {
          console.log("No timeline data found in API response, generating timestamps");

          // Get the frame-specific data from output array if available
          const outputs = response.data.status[0].response.output;
          console.log("Checking output array for frame data:", outputs);

          // Generate timestamps at regular intervals
          const interval = Math.min(5, duration / 10);
          let currentTime = 0;

          while (currentTime < duration) {
            console.log(`Processing frame at time ${currentTime}`);

            // Try to find the closest output data for this timestamp
            const confidence: Record<string, number> = {};

            // Look for frame-specific data in the outputs array
            const frameData = outputs.find((output: any) => {
              return output.time && Math.abs(output.time - currentTime) < interval/2;
            });

            if (frameData && frameData.classes) {
              console.log(`Found frame-specific data for time ${currentTime}:`, frameData);
              frameData.classes.forEach((cls: { class: string; score: number }) => {
                if (!cls.class.startsWith('no_') && cls.score > 0) {
                  const key = cls.class.replace(/^yes_/, '').replace(/_/g, ' ');
                  confidence[key] = cls.score;
                  console.log(`Added frame-specific confidence score: ${key} = ${cls.score}`);
                }
              });
            } else {
              // If no frame-specific data, use the base confidence scores
              const baseClasses = outputs[0].classes;
              baseClasses.forEach((cls: { class: string; score: number }) => {
                if (!cls.class.startsWith('no_') && cls.score > 0) {
                  const key = cls.class.replace(/^yes_/, '').replace(/_/g, ' ');
                  confidence[key] = cls.score;
                }
              });
            }

            videoOutput.push({
              time: currentTime,
              confidence,
            });
            currentTime += interval;
          }

          // Add final timestamp if needed
          if (currentTime - interval + 1 < duration) {
            console.log(`Adding final timestamp at ${duration}s`);
            const confidence = { ...videoOutput[videoOutput.length - 1].confidence };
            videoOutput.push({ time: duration, confidence });
          }
        }

        console.log("Final processed video output:", JSON.stringify(videoOutput, null, 2));
      } catch (e) {
        console.error("Error processing timeline data:", e);
        if (e instanceof Error) {
          console.error("Error details:", {
            message: e.message,
            stack: e.stack,
          });
        }
        console.error("Raw API response for debugging:", JSON.stringify(response.data, null, 2));
      }

      // Process overall confidence scores for the entire video
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

      console.log("Final confidence scores:", scores);

      // Determine status based on significant scores
      const maxScore = Math.max(0, ...Object.values(scores));
      const status = maxScore > 0.8 ? "rejected" : maxScore > 0.4 ? "flagged" : "approved";

      // Create regions for scores above threshold
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

  public async moderateContent(content: Content, filePath?: string): Promise<ModerationResult> {
    try {
      console.log("Starting content moderation for:", content.id);

      if (!filePath) {
        filePath = path.join(process.cwd(), content.url.slice(1));
      }
      console.log("Using file path:", filePath);

      // Verify file exists and is not empty
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const fileStats = statSync(filePath);
      if (fileStats.size === 0) {
        throw new Error("File is empty");
      }

      if (content.type === 'text') {
        const textContent = readFileSync(filePath, 'utf-8');
        return await this.moderateText(textContent);
      } else if (content.type === 'image' || content.type === 'video') {
        return await this.moderateImage(filePath);
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