import * as cheerio from "cheerio";
import readline from "readline";
import fs from "fs";
import chalk from "chalk";
import { join } from "path";

const main = async () => {
  const contentMap = new Map<string, string[]>();

  const visitedSet = new Set<string>();

  const scrape = async (url: string) => {
    visitedSet.add(url);

    let reponse: ReadableStreamDefaultReader<Uint8Array>;

    try {
      reponse = (await fetch(url)).body!.getReader();

      console.info(chalk.green(`Successfully fetched ${url}`));
    } catch (err) {
      return console.error(chalk.red(`Error fetching ${url}: ${err}`));
    }

    let html = "";

    while (true) {
      const chunk = await reponse.read();

      if (chunk.done) break;

      html += Buffer.from(chunk.value).toString("utf8");
    }

    const $ = cheerio.load(html);

    $("*").map((_, elem) => {
      const node = $(elem);

      if (node.is("a")) {
        let href = node.attr("href");

        if (
          !href?.includes("asylum") ||
          href.includes("mailto") ||
          href.includes("facebook") ||
          href.includes("redirect") ||
          href.includes("javascript")
        )
          return;

        if (href.slice(0, 5) !== "https" && href.slice(0, 4) !== "http") {
          href = url.slice(0, url.indexOf("/", 8)) + href;
        }

        if (visitedSet.has(href)) return;

        scrape(href); //.then(() => console.info(`Finished scraping ${href}`));
      } else if (node.is("p")) {
        const content = contentMap.get(url) ?? [];

        const text = node.text();

        if (text.includes("cookie")) return;

        content.push(text);

        contentMap.set(url, content);
      }
    });
  };

  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", (_, key) => {
    if (key.ctrl && key.name == "s") {
      console.info("Saving progress to file...");

      const contentObject: Record<string, string[]> = {};

      contentMap.forEach((content, url) => {
        contentObject[url] = content;
      });

      fs.writeFile(
        join(__dirname, "UKdata.json"),
        JSON.stringify(contentObject),
        (err) => {
          if (err) console.error(err);
        }
      );
    }
  });

  const initialUrl = "https://www.gov.uk/claim-asylum";

  await scrape(initialUrl);
};

main();
