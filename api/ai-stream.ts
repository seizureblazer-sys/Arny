import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, systemPrompt } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const result = await streamText({
      model: google("gemini-1.5-flash"),
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
