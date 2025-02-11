import OpenAI from "openai";
import { AIAnalysis } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeContent(content: string, type: string): Promise<AIAnalysis> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a content moderation API. Analyze content and return a JSON object with moderation details.`
        },
        {
          role: "user",
          content: `Analyze this ${type} content for moderation: ${content}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(response) as {
      category: string;
      confidence: number;
      suggestedAction: "approve" | "reject" | "review";
      flags: Array<{
        type: string;
        severity: number;
        details: string;
      }>;
      risk_score: number;
    };

    // Validate the required fields
    if (!analysis.category || !analysis.suggestedAction || !Array.isArray(analysis.flags)) {
      throw new Error("Invalid analysis format");
    }

    return {
      classification: {
        category: analysis.category,
        confidence: analysis.confidence,
        suggestedAction: analysis.suggestedAction,
      },
      contentFlags: analysis.flags,
      riskScore: analysis.risk_score,
    };
  } catch (error) {
    console.error("Error analyzing content:", error);
    throw new Error("Failed to analyze content");
  }
}