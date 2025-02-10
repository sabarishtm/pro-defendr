import { z } from "zod";

// Define types for TheHive.ai API response
export const classificationResultSchema = z.object({
  confidence: z.number(),
  label: z.string(),
  category: z.string(),
  timestamp: z.string()
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export class ContentClassifier {
  private apiKey: string;
  private apiEndpoint: string;

  constructor() {
    this.apiKey = process.env.THEHIVE_API_KEY || '';
    this.apiEndpoint = 'https://api.thehive.ai/api/v2/task/sync';
  }

  async classifyContent(content: string, type: string): Promise<ClassificationResult> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [{
            type: type === 'text' ? 'text' : 'image_url',
            content: content
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`TheHive API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform TheHive.ai response to our format
      const result: ClassificationResult = {
        confidence: data.status[0].response.inference[0].confidence,
        label: data.status[0].response.inference[0].label,
        category: data.status[0].response.inference[0].category,
        timestamp: new Date().toISOString()
      };

      return result;
    } catch (error) {
      console.error('Content classification error:', error);
      throw error;
    }
  }
}

export const contentClassifier = new ContentClassifier();
