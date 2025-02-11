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
          content: `You are a content moderation API that MUST ALWAYS respond with valid JSON. Never include explanatory text.

Format your response exactly like this example:
{
  "category": "harassment",
  "confidence": 0.95,
  "suggestedAction": "reject",
  "flags": [
    {
      "type": "hate_speech",
      "severity": 8,
      "details": "Contains explicit hate speech targeting protected group"
    }
  ],
  "risk_score": 0.8
}

Remember: Only output the JSON object, nothing else. No explanations before or after.`
        },
        {
          role: "user",
          content: `Analyze this ${type} content for moderation: ${content}`
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent outputs
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    // Try to extract JSON if the response contains any non-JSON text
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const analysis = JSON.parse(jsonStr) as {
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