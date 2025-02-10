import OpenAI from "openai";
import { AIAnalysis } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeContent(content: string, type: string): Promise<AIAnalysis> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a content moderation assistant. Analyze the following ${type} content and provide structured feedback about potential violations, risk level, and suggested actions.`
        },
        {
          role: "user",
          content
        }
      ],
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content) as {
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
