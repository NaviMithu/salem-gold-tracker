import 'dotenv/config';
import * as cheerio from 'cheerio';
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';

const URL = 'https://www.goodreturns.in/gold-rates/salem.html';

export type GoldPrices = {
  '24K': number | null;
  '22K': number | null;
  '18K': number | null;
};

export type HistoricalRate = {
  date: string;
  '24K': string;
  '22K': string;
};

export interface ScrapedGoldData {
  source: string;
  city: string;
  title: string;
  scrapedAt: string;
  currency: string;
  currentPrices: GoldPrices;
  historicalRates: HistoricalRate[];
  selectedHistoricalDate: {
    date: string;
    prices: GoldPrices;
  } | null;
  note: string;
}

function parsePrice(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return null;

  const price = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Fast, lightweight scraper using HTTP fetch and Cheerio.
 * Extremely fast (< 1s), uses < 10MB RAM, perfect for cloud deployment (Render).
 */
async function scrapeWithCheerio(): Promise<ScrapedGoldData | null> {
  try {
    const res = await fetch(URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`Cheerio fetch returned status ${res.status}`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || 'Salem Gold Rate';
    const price24K = parsePrice($('#24K-price').text());
    const price22K = parsePrice($('#22K-price').text());
    const price18K = parsePrice($('#18K-price').text());

    // Scrape historical 10-day table
    const historicalRates: HistoricalRate[] = [];

    // Find table containing Date, 24K, 22K
    $('table').each((_, table) => {
      const text = $(table).text();
      if (/date/i.test(text) && /22k/i.test(text) && /24k/i.test(text)) {
        $(table)
          .find('tbody tr')
          .each((__, tr) => {
            const cells = $(tr).find('th, td');
            if (cells.length >= 3) {
              const date = $(cells[0]).text().replace(/\s+/g, ' ').trim();
              const p24 = $(cells[1]).text().replace(/\s+/g, ' ').trim();
              const p22 = $(cells[2]).text().replace(/\s+/g, ' ').trim();
              if (date && p22) {
                historicalRates.push({
                  date,
                  '24K': p24,
                  '22K': p22,
                });
              }
            }
          });
      }
    });

    if (price22K !== null || historicalRates.length > 0) {
      return {
        source: URL,
        city: 'Salem',
        title,
        scrapedAt: new Date().toISOString(),
        currency: 'INR',
        currentPrices: {
          '24K': price24K,
          '22K': price22K,
          '18K': price18K,
        },
        historicalRates,
        selectedHistoricalDate: null,
        note: 'Scraped via fast lightweight HTTP parser',
      };
    }
  } catch (err) {
    console.warn('Fast Cheerio scraping failed, will attempt fallback:', err);
  }

  return null;
}

/**
 * Headless Selenium scraper (used if Cheerio fails or if interactive browser is explicitly needed).
 */
async function scrapeWithSelenium(targetDate?: string): Promise<ScrapedGoldData> {
  let driver: WebDriver | undefined;

  try {
    const chromeArgs = [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,1200',
    ];

    const chromeOptions: Record<string, unknown> = {
      args: chromeArgs,
    };

    const chromiumBinary =
      process.env.CHROME_BIN ||
      (process.platform === 'linux' ? '/usr/bin/chromium' : undefined);

    if (chromiumBinary) {
      chromeOptions.binary = chromiumBinary;
    }

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions({
        browserName: 'chrome',
        'goog:chromeOptions': chromeOptions,
      } as never)
      .build();

    // Set page load timeout to avoid hanging indefinitely
    await driver.manage().setTimeouts({ pageLoad: 15000, script: 10000 });

    await driver.get(URL);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    await driver.sleep(1500);

    const title = await driver.getTitle();

    // Read prices
    const readElPrice = async (id: string) => {
      const els = await driver!.findElements(By.id(id));
      return els.length > 0 ? parsePrice(await els[0].getText()) : null;
    };

    const initialPrices: GoldPrices = {
      '24K': await readElPrice('24K-price'),
      '22K': await readElPrice('22K-price'),
      '18K': await readElPrice('18K-price'),
    };

    // Extract table
    const history = (await driver.executeScript(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const table = tables.find((item) => {
        const text = item.innerText;
        return /date/i.test(text) && /22K/i.test(text) && /24K/i.test(text);
      });

      if (!table) return [];

      return Array.from(table.querySelectorAll('tr'))
        .map((row) =>
          Array.from(row.querySelectorAll('th, td')).map(
            (cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          ),
        )
        .filter((row) => row.length >= 3)
        .slice(1)
        .map((row) => ({
          date: row[0],
          '24K': row[1],
          '22K': row[2],
        }));
    })) as HistoricalRate[];

    return {
      source: URL,
      city: 'Salem',
      title,
      scrapedAt: new Date().toISOString(),
      currency: 'INR',
      currentPrices: initialPrices,
      historicalRates: history,
      selectedHistoricalDate: null,
      note: 'Scraped via headless browser',
    };
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch {
        // ignore quit error
      }
    }
  }
}

/**
 * Main scrape function.
 * Uses fast Cheerio first (lightning quick & lightweight).
 * Falls back to Selenium if needed.
 */
export async function scrapeGoodreturns(targetDate?: string): Promise<ScrapedGoldData> {
  // If targetDate is not specifically requested, use ultra-fast Cheerio
  if (!targetDate) {
    try {
      const fastResult = await scrapeWithCheerio();
      if (fastResult && fastResult.currentPrices['22K'] !== null) {
        return fastResult;
      }
    } catch (err) {
      console.warn('Cheerio scrape attempt failed, falling back:', err);
    }
  }

  // Fallback to Selenium
  return scrapeWithSelenium(targetDate);
}
