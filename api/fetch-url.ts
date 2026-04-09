import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from "cheerio";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    res.status(200).json({ text: cleanText });
  } catch (error: any) {
    console.error("Error fetching URL:", error);
    if (error.name === 'AbortError') {
      res.status(504).json({ error: "Request timed out" });
    } else {
      res.status(500).json({ error: error.message || "Failed to fetch URL" });
    }
  }
}
