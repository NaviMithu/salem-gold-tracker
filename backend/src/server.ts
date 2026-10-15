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

let cachedData: ApiResponseData22K | null = null;
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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    app: 'Salem Gold Tracker API (22K Focus - 30 Days History)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cached: !!cachedData && Date.now() - lastScrapedTime < CACHE_TTL_MS,
  });
});

// Main endpoint for Expo Mobile App
app.get('/api/gold-rates', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const isFresh = cachedData && Date.now() - lastScrapedTime < CACHE_TTL_MS;

  // If data was scraped within the last 5 minutes and no force refresh requested, return cached response
  if (!forceRefresh && isFresh && cachedData) {
    return res.json({
      ...cachedData,
      cached: true,
    });
  }

  try {
    const rawData = await scrapeGoodreturns();
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
    console.error('Error in /api/gold-rates scraper:', error);

    // Fallback: If scraper failed, return current 30-day store
    const fallbackHistory = get30DaysHistory();
    const fallbackRate = fallbackHistory[0]?.rate22K ?? 13515;
    const fallbackYesterday = fallbackHistory[1]?.rate22K ?? fallbackRate;
    const fallbackChange = fallbackHistory[0]?.change22K ?? 0;

    return res.json({
      success: true,
      cached: true,
      stale: true,
      scrapedAt: new Date().toISOString(),
      today: {
        city: 'Salem',
        currency: 'INR',
        purity: '22K',
        date: fallbackHistory[0]?.date || 'Today',
        displayDate: fallbackHistory[0]?.date || 'Today',
        rate22K: fallbackRate,
        sovereign22K: fallbackRate * 8,
        yesterdayRate22K: fallbackYesterday,
        change22K: fallbackChange,
        changePercentage: Number(((fallbackChange / (fallbackYesterday || 1)) * 100).toFixed(2)),
      },
      history: fallbackHistory,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Tracker backend running on port ${PORT} (Salem 22K - 30 Days)`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Gold rates API: http://localhost:${PORT}/api/gold-rates`);
});