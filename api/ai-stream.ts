import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, systemPrompt, modelId } = req.body;

    let model;
    
    switch (modelId) {
      case 'gemini-1.0-pro':
        model = google("gemini-1.0-pro");
        break;
      case 'gemini-1.5-pro':
        model = google("gemini-3.1-pro-preview");
        break;
      case 'claude-3-opus':
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
        }
        model = anthropic("claude-3-opus-20240229");
        break;
      case 'gemini-1.5-flash':
      default:
        model = google("gemini-3-flash-preview");
        break;
    }

    if (modelId?.startsWith('gemini') && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const result = await streamText({
      model: model,
      system: systemPrompt || "You are a helpful assistant.",
      prompt: prompt,
    });

    // Set headers for streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    // Pipe the text stream to the response in the Vercel AI SDK format (0:"text")
    for await (const textPart of result.textStream) {
      res.write(`0:${JSON.stringify(textPart)}\n`);
    }
    
    res.end();
  } catch (error: any) {
    console.error("AI Stream Error:", error);
    res.status(500).json({ error: error.message || "AI Stream failed" });
  }
}
