import chalk from "chalk";
import { redis } from "~/lib/redis";
import ConcurrencyLimiter from "./util/ConcurrencyLimiter";
import makeTerminateFaster from "./util/makeTerminateFaster";
import LinkFollower from "./util/LinkFollower";
import { datasetStartingLinks } from "~/lib/datasets";
import selectedDataset from "./selectedDataset";
import { keys } from "~/lib/redis";
import { scraperApiKey } from "./lib/scraperApiKey";

const MAX_CONCURRENT_FUNCTION_CALLS = 10;

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
	const linkFollower = new LinkFollower(
		({ url }) => {
			console.info(chalk.green(url));
			redis.sadd(keys[selectedDataset].urls, url);
		},
		({ url, error }) => {
			console.error(chalk.red(JSON.stringify({ url, error }, null, 4)));
		},
		(url) => {
			return (
				(selectedDataset === "uscis"
					? url.includes("uscis.gov") &&
					  !url.includes("/es/") &&
					  !url.includes("password") &&
					  !url.includes("history")
					: !url.includes("www.asylumlawdatabase.eu") &&
					  !url.includes("policy")) &&
				!url.includes("mailto") &&
				!url.includes("facebook") &&
				!url.includes("twitter") &&
				!url.includes("redirect") &&
				!url.includes("javascript") &&
				!url.includes("home-affairs") &&
				!url.includes("case-law") &&
				!url.includes("blog") &&
				!url.includes("fb-messenger") &&
				!url.includes("linkedin") &&
				!url.includes("rfi.fr") &&
				!url.includes("freemovement.org.uk") &&
				!url.includes("europa.eu") &&
				!url.includes("authenticate")
			);
		},
		selectedDataset === "uscis"
			? (url) => {
					return `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${url}`.replace(
						"uscis.go/",
						"uscis.gov/"
					);
			  }
			: (url) => url,
		concurrencyLimiter,
		{
			n: 10,
			do: (urlsVisited) => {
				console.info(`${urlsVisited} urls visited`);
			},
		}
	);

	linkFollower.follow(datasetStartingLinks[selectedDataset]);
};

main();
