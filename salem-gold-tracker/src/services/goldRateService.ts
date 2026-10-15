export type GoldRate = {
  date: string;
  city: string;
  purity: '22K';
  pricePerGram: number;
  source: string;
  fetchedAt: string;
};

const GOLD_RATE_URL =
  'https://www.goodreturns.in/gold-rates/salem.html';

export async function fetchGoldRate(): Promise<GoldRate> {
  // The Goodreturns URL is a webpage, not a documented JSON API.
  // We will connect this to our backend in the next step.
  // Do not return a fake price as if it were live data.

  throw new Error(
    `Live rate retrieval is not configured yet. Source: ${GOLD_RATE_URL}`,
  );
}