import chalk from "chalk";
import { redis, keys } from "~/lib/redis";
import selectedDataset from "./selectedDataset";
import HTMLScraper from "./util/HTMLScraper";
import ConcurrencyLimiter from "./util/ConcurrencyLimiter";
import makeTerminateFaster from "./util/makeTerminateFaster";

const MAX_CONCURRENT_FUNCTION_CALLS = 10;

const MIN_SEGMENT_WORDS = 225;

const MIN_URL_WORDS = 100;

const concurrencyLimiter = new ConcurrencyLimiter(
	MAX_CONCURRENT_FUNCTION_CALLS,
	({ functionsRunning }) => {
		console.info(`${functionsRunning} functions running`);
	},
	() => {
		console.info("Finished");

		process.exit();
	}
);

makeTerminateFaster();

const main = async () => {
	const htmlScraper = new HTMLScraper(
		concurrencyLimiter,
		async ({ url, segments, title }) => {
			if (url.endsWith("sitemap")) return;

			console.info(
				chalk.green(`${title}: ${url}
${segments.join(`
#####
`)}
`)
			);

			try {
				await Promise.all([
					redis.sadd(
						keys[selectedDataset].urlData({ url }),
						...segments
					),
					redis.set(keys[selectedDataset].urlTitle({ url }), title),
				]);
			} catch (error) {
				console.error(chalk.red(`${url}: ${error}`));

				process.exit(1);
			}
		},
		({ url }) => {
			console.info(chalk.blue(url));
		},
		(elem) => {
			return !(
				elem.text()[0] === "[" ||
				(elem.is("ul") && elem.hasClass("children")) ||
				(elem.is("li") && elem.hasClass("menu__item"))
			);
		},
		({ url, error }) => {
			console.error(chalk.red(`${url}: ${error}`));
		},
		MIN_SEGMENT_WORDS,
		MIN_URL_WORDS,
		{
			n: 10,
			do: ({ urlsProcessed, wordsProcessed }) => {
				console.info(
					`${urlsProcessed} urls processed and ${wordsProcessed} words processed`
				);
			},
		}
	);

	const urls = await redis.smembers(keys[selectedDataset].urls);

	await htmlScraper.scrape(urls);
};

main();
