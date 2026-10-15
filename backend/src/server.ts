import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scrapeGoodreturns } from './scraper.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

export interface GoldRateToday {
  city: string;
  currency: string;
  date: string;
  displayDate: string;
  rate22K: number;
  rate24K: number;
  rate18K: number | null;
  yesterdayRate22K: number | null;
  change22K: number;
  changePercentage: number;
}

export interface HistoricalRateItem {
  date: string;
  shortDate: string;
  rate22K: number;
  change22K: number;
  rate24K: number;
  change24K: number;
}

export interface ApiResponseData {
  success: boolean;
  cached: boolean;
  scrapedAt: string;
  today: GoldRateToday;
  history: HistoricalRateItem[];
}

let cachedData: ApiResponseData | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
    app: 'Salem Gold Tracker API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cached: !!cachedData && Date.now() < cacheExpiresAt,
  });
});

// Main endpoint for Expo Mobile App
app.get('/api/gold-rates', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';

  if (!forceRefresh && cachedData && Date.now() < cacheExpiresAt) {
    return res.json({
      ...cachedData,
      cached: true,
    });
  }

  try {
    const rawData = await scrapeGoodreturns();
    const prices = rawData.currentPrices;

    if (prices['22K'] === null && (!rawData.historicalRates || rawData.historicalRates.length === 0)) {
      return res.status(502).json({
        success: false,
        message: 'Could not extract Salem gold rates from website.',
      });
    }

    // Format historical rates from table
    const formattedHistory: HistoricalRateItem[] = (rawData.historicalRates || []).map((item) => {
      const parsed22K = parseTableRate(item['22K'] || '');
      const parsed24K = parseTableRate(item['24K'] || '');
      const short = item.date.replace(/,?\s*\d{4}$/, '').trim(); // e.g. "Oct 15"

      return {
        date: item.date,
        shortDate: short,
        rate22K: parsed22K.price,
        change22K: parsed22K.change,
        rate24K: parsed24K.price,
        change24K: parsed24K.change,
      };
    });

    const rate22K = prices['22K'] ?? (formattedHistory[0]?.rate22K ?? 0);
    const rate24K = prices['24K'] ?? (formattedHistory[0]?.rate24K ?? 0);
    const rate18K = prices['18K'] ?? null;

    // Yesterday's 22K rate from the second row of history
    const yesterdayRate22K = formattedHistory.length > 1 ? formattedHistory[1].rate22K : null;
    const change22K = yesterdayRate22K ? rate22K - yesterdayRate22K : (formattedHistory[0]?.change22K ?? 0);
    const changePercentage =
      yesterdayRate22K && yesterdayRate22K > 0
        ? Number(((change22K / yesterdayRate22K) * 100).toFixed(2))
        : 0;

    const todayDate = formattedHistory[0]?.date || new Date().toISOString();

    const responsePayload: ApiResponseData = {
      success: true,
      cached: false,
      scrapedAt: rawData.scrapedAt,
      today: {
        city: 'Salem',
        currency: 'INR',
        date: todayDate,
        displayDate: formatDate(todayDate),
        rate22K,
        rate24K,
        rate18K,
        yesterdayRate22K,
        change22K,
        changePercentage,
      },
      history: formattedHistory,
    };

    cachedData = responsePayload;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching gold rates:', error);

    // If scraping failed but we have stale cache, return stale cache with warning
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        stale: true,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve gold rates.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Tracker backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Gold rates: http://localhost:${PORT}/api/gold-rates`);
});