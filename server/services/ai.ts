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
          content: `You are a content moderation assistant. Analyze the following ${type} content and provide structured feedback about potential violations, risk level, and suggested actions. Respond with a JSON object containing: 
          {
            "category": "string - content category",
            "confidence": "number between 0-1",
            "suggestedAction": "approve/reject/review",
            "flags": [{"type": "string", "severity": "number 1-10", "details": "string"}],
            "risk_score": "number between 0-1"
          }`
        },
        {
          role: "user",
          content
        }
      ]
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