import * as cheerio from "cheerio";
import readline from "readline";
import chalk from "chalk";
import { redis } from "~/lib/redis";

const keys = {
  htmlUrls: "asylumineuropehtmlurls",
  htmlData: "asylumineuropehtmldata",
};

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

const MAX_CONCURRENT_FUNCTION_CALLS = 10;

let functionCalls = 0;

let functionCompletions = 0;

let wordsProcessed = 0;

let articlesProcessed = 0;

const MIN_SEGMENT_LENGTH = 50;

const MIN_ARTICLE_LENGTH = 100;

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
        }, 50);
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
        `Finished, with a total of ${wordsProcessed} words processed and ${articlesProcessed} articles processed`
      );

      process.exit(0);
    }
  };
};

const main = async () => {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.on("keypress", (_, key) => {
    if (key.ctrl && key.name == "c") {
      console.info(
        `Total of ${wordsProcessed} words processed and ${articlesProcessed} articles processed`
      );

      process.exit();
    }
  });

  const urls = await redis.smembers(keys.htmlUrls);

  for (const url of urls) {
    trackFunction(async () => {
      let html: string;

      try {
        html = await getHTML(url);
      } catch (err) {
        return console.error(chalk.red(`Error getting html of ${url}: ${err}`));
      }

      const $ = cheerio.load(html);

      let words = 0;

      let previousIncompleteText = "";

      const segments: string[] = [];

      $("main *").map((_, elem) => {
        const node = $(elem);

        let text: string;

        if (node.is("p") || node.is("ul")) {
          text = node.text();

          if (text[0] === "[" || (node.is("ul") && node.hasClass("children")))
            return;

          text = text.replaceAll(/[ \t]/g, " ").trim();

          if (text.length === 0) return;

          const wordsAdded = text.split(" ").length;

          words += wordsAdded;

          if (wordsAdded < MIN_SEGMENT_LENGTH) {
            previousIncompleteText += `
            ${text}`;
          } else {
            segments.push(
              previousIncompleteText +
                `
            ${text}`
            );

            previousIncompleteText = "";
          }
        }
      });

      if (previousIncompleteText.length > 0) {
        segments.push(previousIncompleteText);
      }

      if (words < MIN_ARTICLE_LENGTH) {
        console.info(chalk.blue(`${url} is too short`));
        return;
      } else {
        console.info(chalk.green(`${url} is long enough`));
      }

      redis.sadd(keys.htmlData, ...segments);

      articlesProcessed++;
      wordsProcessed += words;

      if (articlesProcessed % 10 === 0) {
        console.info(
          `${wordsProcessed} words processed and ${articlesProcessed} articles processed`
        );
      }
    })();
  }
};

main();
