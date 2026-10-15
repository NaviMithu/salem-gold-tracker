import 'dotenv/config';
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';

const URL = 'https://www.goodreturns.in/gold-rates/salem.html';

type GoldPrices = {
  '24K': number | null;
  '22K': number | null;
  '18K': number | null;
};

type HistoricalRate = {
  date: string;
  '24K': string;
  '22K': string;
};

function parsePrice(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d+)?/);

  if (!match) return null;

  const price = Number(match[0].replace(/,/g, ''));

  return Number.isFinite(price) && price > 0 ? price : null;
}

async function readPrice(
  driver: WebDriver,
  id: string,
): Promise<number | null> {
  const elements = await driver.findElements(By.id(id));

  if (elements.length === 0) {
    return null;
  }

  return parsePrice(await elements[0].getText());
}

async function readPrices(driver: WebDriver): Promise<GoldPrices> {
  return {
    '24K': await readPrice(driver, '24K-price'),
    '22K': await readPrice(driver, '22K-price'),
    '18K': await readPrice(driver, '18K-price'),
  };
}

export async function scrapeGoodreturns(targetDate?: string) {
  let driver: WebDriver | undefined;

  try {
    // Start Chrome in headless mode.
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions({
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--headless=new',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1440,1200',
          ],
        },
      } as never)
      .build();

    // Open the Salem gold-rate page.
    await driver.get(URL);

    await driver.wait(
      until.elementLocated(By.css('body')),
      15000,
    );

    await driver.sleep(2000);

    const title = await driver.getTitle();
    const initialPrices = await readPrices(driver);

    // Inspect the date picker before attempting to change it.
    const datePickerInfo = await driver.executeScript(() => {
      const input = document.querySelector(
        '#gold-date-picker',
      ) as HTMLInputElement | null;

      return {
        exists: !!input,
        value: input?.value ?? null,
        min: input?.min ?? null,
        max: input?.max ?? null,
        outerHTML: input?.outerHTML ?? null,
        nearbyText:
          input?.parentElement?.parentElement?.innerText ?? null,
      };
    });

    console.log(
      'DATE PICKER INFO:',
      JSON.stringify(datePickerInfo, null, 2),
    );

    // Extract the historical rates displayed in the table.
    const history = (await driver.executeScript(() => {
      const tables = Array.from(
        document.querySelectorAll('table'),
      );

      const table = tables.find((item) => {
        const text = item.innerText;

        return (
          /date/i.test(text) &&
          /22K/i.test(text) &&
          /24K/i.test(text)
        );
      });

      if (!table) {
        return [];
      }

      return Array.from(table.querySelectorAll('tr'))
        .map((row) =>
          Array.from(row.querySelectorAll('th, td')).map(
            (cell) =>
              cell.textContent?.replace(/\s+/g, ' ').trim() ?? '',
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

    // Optional date supplied through targetDate parameter or SCRAPER_FORCE_DATE
    const requestedDate = targetDate ?? process.env.SCRAPER_FORCE_DATE;

    let selectedHistoricalDate: {
      date: string;
      prices: GoldPrices;
    } | null = null;

    if (requestedDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        throw new Error(
          'GOLD_DATE must use YYYY-MM-DD format.',
        );
      }

      // Find the date picker and inspect its allowed date range.
      const dateInput = await driver.findElement(
        By.id('gold-date-picker'),
      );

      const range = await driver.executeScript(
        (element: HTMLInputElement) => ({
          min: element.min,
          max: element.max,
        }),
        dateInput,
      ) as { min: string; max: string };

      if (
        (range.min && requestedDate < range.min) ||
        (range.max && requestedDate > range.max)
      ) {
        throw new Error(
          `Requested date ${requestedDate} is outside the ` +
          `allowed range ${range.min} to ${range.max}.`,
        );
      }

      // Set the date and dispatch browser events.
      await driver.executeScript(
        (element: HTMLInputElement, date: string) => {
          element.value = date;
          element.dispatchEvent(
            new Event('input', { bubbles: true }),
          );
          element.dispatchEvent(
            new Event('change', { bubbles: true }),
          );
        },
        dateInput,
        requestedDate,
      );

      await driver.sleep(2000);

      // Verify the date input accepted the requested date.
      const selectedDate = await driver.executeScript(() => {
        const input = document.querySelector(
          '#gold-date-picker',
        ) as HTMLInputElement | null;

        return input?.value ?? '';
      });

      console.log('REQUESTED DATE:', requestedDate);
      console.log('SELECTED DATE:', selectedDate);

      if (selectedDate !== requestedDate) {
        throw new Error(
          `Date picker did not select ${requestedDate}.`,
        );
      }

      // Read the prices after changing the date.
      const selectedPrices = await readPrices(driver);

      console.log(
        'PRICES AFTER DATE SELECTION:',
        JSON.stringify(selectedPrices, null, 2),
      );

      selectedHistoricalDate = {
        date: selectedDate,
        prices: selectedPrices,
      };
    }

    // Return all collected information as JSON.
    return {
      source: URL,
      city: 'Salem',
      title,
      scrapedAt: new Date().toISOString(),
      currency: 'INR',
      currentPrices: initialPrices,
      historicalRates: history,
      selectedHistoricalDate,
      note:
        'Historical table values are scraped from the displayed table. ' +
        'Prices read after date selection must be verified against ' +
        'the website before being treated as historical prices.',
    };
  } finally {
    // Always close Chrome, even if scraping fails.
    if (driver) {
      await driver.quit();
    }
  }
}


