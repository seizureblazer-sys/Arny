import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Stripe checkout session creation
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { priceId, userId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.APP_URL}/dashboard?success=true`,
        cancel_url: `${process.env.APP_URL}/pricing`,
        client_reference_id: userId,
      });
      res.json({ id: session.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API route to fetch and extract text from a URL
  app.post("/api/fetch-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove scripts, styles, nav, footer, etc. to get clean text
      $('script, style, nav, footer, header, aside, noscript, iframe').remove();

      // Try to find the main article content first
      let content = $('article').text();
      if (!content.trim()) {
        content = $('main').text();
      }
      if (!content.trim()) {
        content = $('body').text();
      }

      // Clean up whitespace
      const cleanText = content.replace(/\s+/g, ' ').trim();

      res.json({ text: cleanText });
    } catch (error: any) {
      console.error("Error fetching URL:", error);
      res.status(500).json({ error: error.message || "Failed to fetch URL" });
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
