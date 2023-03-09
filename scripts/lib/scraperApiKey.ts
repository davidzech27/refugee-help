export const scraperApiKey =
  process.env.SCRAPER_API_KEY ??
  (() => {
    console.error("Must sent SCRAPER_API_KEY environment variable");

    process.exit(1);
  })();
