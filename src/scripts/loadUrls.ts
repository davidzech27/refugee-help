import * as cheerio from "cheerio";
import readline from "readline";
import chalk from "chalk";
import { scraperApiKey } from "./scraperApiKey";
import { redis } from "~/lib/redis";

const keys = {
  asylumineurope: {
    htmlUrls: "asylumineuropehtmlurls",
    pdfUrls: "asylumineuropepdfurls",
    xlsxUrls: "asylumineuropexlsxurls",
    errorUrls: "asylumineuropeerrorurls",
  },
  uscis: {
    htmlUrls: "uscishtmlurls",
    pdfUrls: "uscispdfurls",
    xlsxUrls: "uscisxlsxurls",
    errorUrls: "usciserrorurls",
  },
};

const useScraper = true;

const getHTML = async (url: string) => {
  const response = (await fetch(url)).body!.getReader();

  let html = "";

  while (true) {
    const chunk = await response.read();
    if (chunk.done) break;
    html += Buffer.from(chunk.value).toString("utf8");
  }

  return html;
};

const visitedUrlSet = new Set<string>();

const MAX_CONCURRENT_FUNCTION_CALLS = 5;

let functionCalls = 0;

let functionCompletions = 0;

const trackFunction = <TArgs extends any[]>(
  fn: (...args: TArgs) => Promise<any>
) => {
  return async (...args: TArgs) => {
    if (functionCalls - functionCompletions >= MAX_CONCURRENT_FUNCTION_CALLS) {
      // suboptimal
      await new Promise((res) => {
        const intervalId = setInterval(() => {
          if (
            functionCalls - functionCompletions <
            MAX_CONCURRENT_FUNCTION_CALLS
          ) {
            clearInterval(intervalId);

            functionCalls++;

            fn(...args).then(res);
          }
        }, 100);
      });
    } else {
      functionCalls++;

      await fn(...args);
    }

    functionCompletions++;

    const functionsRunning = functionCalls - functionCompletions;

    console.info(chalk.cyan(`${functionsRunning} functions running`));

    if (functionsRunning === 0) {
      console.info(
        `Finished, with a total of ${visitedUrlSet.size} urls visited`
      );

      process.exit(0);
    }
  };
};

const main = async () => {
  const scrape = async (url: string, category: keyof typeof keys) => {
    let html: string;

    try {
      html = await getHTML(
        !useScraper
          ? url
          : `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${url}`
      );
    } catch (err) {
      return err;
    }

    const $ = cheerio.load(html);

    $("a").map((_, elem) => {
      const node = $(elem);
      let href = node.attr("href");

      if (href === undefined) return;

      if (
        (!href.includes("asylum") && category !== "uscis") ||
        (category === "uscis" &&
          (!href.includes("uscis") ||
            href.includes("uscis.gov//es") ||
            href.includes("history") ||
            href.includes("authenticate"))) ||
        href.includes("mailto") ||
        href.includes("facebook") ||
        href.includes("twitter") ||
        href.includes("redirect") ||
        href.includes("javascript") ||
        href.includes("home-affairs") ||
        href.includes("case-law") ||
        href.includes("blog") ||
        href.includes("fb-messenger") ||
        href.includes("policy") ||
        href.includes("linkedin") ||
        href.includes("rfi.fr") ||
        href.includes("freemovement.org.uk") ||
        href.includes("europa.eu") ||
        href.includes("www.asylumlawdatabase.eu") ||
        href[0] === "#"
      )
        return;

      href = href.replace("uscis.go/", "uscis.gov/");

      if (href[0] === "/") {
        href = url.slice(0, url.indexOf("/", 8)) + href;
      }

      if (href.endsWith(".pdf")) {
        console.info(chalk.blue(href));

        redis.sadd(keys[category].pdfUrls, href);

        return;
      }

      if (href.endsWith(".xlsx")) {
        console.info(chalk.yellow(href));

        redis.sadd(keys[category].xlsxUrls, href);

        return;
      }

      if (visitedUrlSet.has(href)) {
        return;
      }

      visitedUrlSet.add(href);

      if (visitedUrlSet.size % 10 === 0) {
        console.info(`Visited ${visitedUrlSet.size} urls`);
      }

      trackFunction(scrape)(href, category).then((err) => {
        if (err !== undefined) {
          console.error(chalk.red(JSON.stringify({ url: href, err }, null, 4)));

          redis.sadd(keys[category].errorUrls, href);
        } else {
          console.info(chalk.green(href));

          redis.sadd(keys[category].htmlUrls, href);
        }
      });
    });
  };

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.on("keypress", (_, key) => {
    if (key.ctrl && key.name == "c") {
      process.exit();
    }
  });

  const categories = {
    uscis: async () =>
      await trackFunction(scrape)(
        "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum/obtaining-asylum-in-the-united-states",
        "uscis"
      ),
    asylumineurope: async () =>
      await trackFunction(scrape)(
        "https://asylumineurope.org/",
        "asylumineurope"
      ),
  };

  await categories["uscis"]();
};

main();
