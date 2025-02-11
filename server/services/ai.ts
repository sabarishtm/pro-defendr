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
          content: `You are a content moderation API. You must analyze content and return a JSON object with the following required structure and fields:
{
  "category": "string (e.g., spam, harassment, violence, adult)",
  "confidence": "number between 0 and 1",
  "suggestedAction": "one of: approve, reject, review",
  "flags": [
    {
      "type": "string describing violation type",
      "severity": "number between 1 and 10",
      "details": "string explaining the issue"
    }
  ],
  "risk_score": "number between 0 and 1"
}
Every field is required and must follow these types exactly.`
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

    console.log("Raw OpenAI response:", response);

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

    console.log("Parsed analysis:", JSON.stringify(analysis, null, 2));

    // Validate the required fields
    if (!analysis.category || !analysis.suggestedAction || !Array.isArray(analysis.flags)) {
      throw new Error("Invalid analysis format");
    }

    // Ensure risk_score and confidence are numbers between 0 and 1
    analysis.risk_score = Math.max(0, Math.min(1, analysis.risk_score));
    analysis.confidence = Math.max(0, Math.min(1, analysis.confidence));

    // Ensure flag severity is between 1 and 10
    analysis.flags = analysis.flags.map(flag => ({
      ...flag,
      severity: Math.max(1, Math.min(10, flag.severity))
    }));

    const result: AIAnalysis = {
      classification: {
        category: analysis.category,
        confidence: analysis.confidence,
        suggestedAction: analysis.suggestedAction,
      },
      contentFlags: analysis.flags,
      riskScore: analysis.risk_score,
    };

    console.log("Final processed result:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("Error analyzing content:", error);
    throw new Error("Failed to analyze content");
  }
}