import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scrapeGoodreturns } from './scraper.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Test whether the backend is running.
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'Salem Gold Tracker backend is running',
  });
});

// Fetch current gold rates from Goodreturns.
app.get('/api/gold-rates', async (_req, res) => {
  try {
    const data = await scrapeGoodreturns();

    // Return an error if the expected prices were not found.
    const prices = data.currentPrices;

    if (
      prices['24K'] === null ||
      prices['22K'] === null ||
      prices['18K'] === null
    ) {
      return res.status(502).json({
        success: false,
        message: 'Could not retrieve all gold prices from Goodreturns.',
        data,
      });
    }

    return res.json({
      success: true,
      message: 'Gold rates retrieved successfully',
      data,
    });
  } catch (error) {
    console.error('Gold rate API error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve gold rates.',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Tracker backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Gold rates: http://localhost:${PORT}/api/gold-rates`);
});