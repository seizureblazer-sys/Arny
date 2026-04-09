import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";
import dotenv from "dotenv";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to fetch and extract text from a URL
  app.post("/api/fetch-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, nav, footer, header, aside, noscript, iframe, svg, button, input, select, textarea, menu, form').remove();

      // Extract main content
      let content = $('article').text() || $('main').text() || $('body').text();
      
      // Clean up whitespace and line breaks
      const cleanText = content.replace(/\s+/g, ' ').trim();

      if (cleanText.length < 100) {
        return res.status(422).json({ error: "Could not extract sufficient content from the page." });
      }

      res.json({ text: cleanText });
    } catch (error: any) {
      console.error("Error fetching URL:", error);
      if (error.name === 'AbortError') {
        res.status(504).json({ error: "Request timed out" });
      } else {
        res.status(500).json({ error: error.message || "Failed to fetch URL" });
      }
    }
  });

  // AI Streaming Endpoint
  app.post("/api/ai/stream", async (req, res) => {
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
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
