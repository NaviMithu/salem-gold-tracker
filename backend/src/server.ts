import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scrapeGoodreturns } from './scraper.js';
import {
  get30DaysHistory,
  mergeScrapedHistory,
  DayRate22K,
} from './historyStore.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

export interface GoldRateToday22K {
  city: string;
  currency: string;
  purity: '22K';
  date: string;
  displayDate: string;
  rate22K: number;
  sovereign22K: number; // 8 grams rate
  yesterdayRate22K: number;
  change22K: number;
  changePercentage: number;
}

export interface ApiResponseData22K {
  success: boolean;
  cached: boolean;
  scrapedAt: string;
  today: GoldRateToday22K;
  history: DayRate22K[]; // Exactly 30 days of data
}

// Seed initial cached data immediately so the server is never empty on cold start
const initialHistory = get30DaysHistory();
const initialRate = initialHistory[0]?.rate22K ?? 13515;
const initialYesterday = initialHistory[1]?.rate22K ?? initialRate;
const initialChange = initialHistory[0]?.change22K ?? -75;

let cachedData: ApiResponseData22K = {
  success: true,
  cached: true,
  scrapedAt: new Date().toISOString(),
  today: {
    city: 'Salem',
    currency: 'INR',
    purity: '22K',
    date: initialHistory[0]?.date || 'Oct 15, 2026',
    displayDate: initialHistory[0]?.date || '15 October 2026',
    rate22K: initialRate,
    sovereign22K: initialRate * 8,
    yesterdayRate22K: initialYesterday,
    change22K: initialChange,
    changePercentage: Number(((initialChange / (initialYesterday || 1)) * 100).toFixed(2)),
  },
  history: initialHistory,
};

let lastScrapedTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes freshness window

function parseTableRate(raw: string): { price: number; change: number } {
  const priceMatch = raw.match(/₹?\s*([\d,]+)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : 0;

  const changeMatch = raw.match(/\(([+-]?\d+)\)/);
  const change = changeMatch ? Number(changeMatch[1]) : 0;

  return { price, change };
}

function formatDate(isoOrDateStr: string): string {
  const dateObj = new Date(isoOrDateStr);
  if (isNaN(dateObj.getTime())) {
    return isoOrDateStr;
  }
  return dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Friendly status route for web browser visitors
app.get('/', (_req, res) => {
  const currentRate = cachedData.today.rate22K;
  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Salem Gold Tracker API</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #0f172a;
          color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 32px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          text-align: center;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #064e3b;
          color: #34d399;
          font-size: 13px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 9999px;
          margin-bottom: 16px;
        }
        .pulse {
          width: 8px;
          height: 8px;
          background: #34d399;
          border-radius: 50%;
          box-shadow: 0 0 8px #34d399;
        }
        h1 { margin: 0 0 8px; font-size: 24px; color: #facc15; }
        p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
        .rate-box {
          background: #0f172a;
          border: 1px solid #eab30833;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .rate-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .rate-value { font-size: 28px; font-weight: 700; color: #facc15; margin: 4px 0; }
        .rate-sub { font-size: 12px; color: #64748b; }
        .links { display: flex; flex-direction: column; gap: 10px; }
        .btn {
          display: block;
          background: #eab308;
          color: #0f172a;
          font-weight: 600;
          padding: 12px 20px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s;
        }
        .btn:hover { background: #ca8a04; }
        .btn-outline {
          background: transparent;
          color: #94a3b8;
          border: 1px solid #334155;
        }
        .btn-outline:hover { background: #334155; color: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge"><div class="pulse"></div> API Online</div>
        <h1>Salem Gold Tracker API</h1>
        <p>Live 22K gold rates backend service for Android app with 30-day historical trend.</p>
        <div class="rate-box">
          <div class="rate-label">Current 22K Gold Rate</div>
          <div class="rate-value">₹${currentRate.toLocaleString('en-IN')} / g</div>
          <div class="rate-sub">Updated for Salem, Tamil Nadu</div>
        </div>
        <div class="links">
          <a class="btn" href="/api/gold-rates" target="_blank">View JSON API (/api/gold-rates)</a>
          <a class="btn btn-outline" href="/health" target="_blank">System Health (/health)</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    app: 'Salem Gold Tracker API (22K Focus - 30 Days History)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cached: Date.now() - lastScrapedTime < CACHE_TTL_MS,
  });
});

// Main endpoint for Expo Mobile App
app.get('/api/gold-rates', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const isFresh = lastScrapedTime > 0 && Date.now() - lastScrapedTime < CACHE_TTL_MS;

  // If data was scraped recently and no force refresh requested, return cached response instantly
  if (!forceRefresh && isFresh) {
    return res.json({
      ...cachedData,
      cached: true,
    });
  }

  try {
    // 6-second timeout race safeguard to ensure response is NEVER delayed or hanging
    const scrapePromise = scrapeGoodreturns();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Scraper timed out after 6000ms, using seeded cache')), 6000)
    );
    const rawData = await Promise.race([scrapePromise, timeoutPromise]);
    const prices = rawData.currentPrices;

    // Parse scraped historical table (10 days from Goodreturns)
    const scraped10Days: DayRate22K[] = (rawData.historicalRates || []).map((item) => {
      const parsed22K = parseTableRate(item['22K'] || '');
      const short = item.date.replace(/,?\s*\d{4}$/, '').trim();
      return {
        date: item.date,
        shortDate: short,
        rate22K: parsed22K.price,
        change22K: parsed22K.change,
      };
    });

    // Merge scraped days into 30-day historical dataset
    const history30Days = mergeScrapedHistory(scraped10Days);

    const rate22K = prices['22K'] ?? history30Days[0]?.rate22K ?? 13515;
    const sovereign22K = rate22K * 8; // 1 Sovereign (Pavan)

    const yesterdayRate22K = history30Days.length > 1 ? history30Days[1].rate22K : rate22K;
    const change22K = history30Days[0]?.change22K ?? (rate22K - yesterdayRate22K);
    const changePercentage =
      yesterdayRate22K > 0
        ? Number(((change22K / yesterdayRate22K) * 100).toFixed(2))
        : 0;

    const todayDate = history30Days[0]?.date || new Date().toISOString();

    const responsePayload: ApiResponseData22K = {
      success: true,
      cached: false,
      scrapedAt: rawData.scrapedAt,
      today: {
        city: 'Salem',
        currency: 'INR',
        purity: '22K',
        date: todayDate,
        displayDate: formatDate(todayDate),
        rate22K,
        sovereign22K,
        yesterdayRate22K,
        change22K,
        changePercentage,
      },
      history: history30Days, // 30 items for full month
    };

    cachedData = responsePayload;
    lastScrapedTime = Date.now();

    return res.json(responsePayload);
  } catch (error) {
    console.error('Scraper issue, serving seeded/cached 30-day data:', error);

    // Guaranteed fallback: Always returns valid 30-day data instantly
    return res.json({
      ...cachedData,
      cached: true,
      stale: true,
      error: error instanceof Error ? error.message : 'Scraper fallback',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Tracker backend running on port ${PORT} (Salem 22K - 30 Days)`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Gold rates API: http://localhost:${PORT}/api/gold-rates`);
});