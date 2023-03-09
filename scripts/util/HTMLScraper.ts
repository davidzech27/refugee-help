import * as cheerio from "cheerio";
import ConcurrencyLimiter from "./ConcurrencyLimiter";
import getHTML from "./getHTML";

class HTMLScraper {
	constructor(
		private concurrencyLimiter: ConcurrencyLimiter,
		private onLongEnough: ({
			url,
			segments,
			title,
		}: {
			url: string;
			segments: string[];
			title: string;
		}) => void,
		private onTooShort: ({ url }: { url: string }) => void,
		private elemFilter: (elem: cheerio.Cheerio<cheerio.Element>) => boolean,
		private onError: ({
			url,
			error,
		}: {
			url: string;
			error: unknown;
		}) => void,
		private readonly minSegmentWords: number,
		private readonly minUrlWords: number,
		private everyN: {
			n: number;
			do: ({
				urlsProcessed,
				wordsProcessed,
			}: {
				urlsProcessed: number;
				wordsProcessed: number;
			}) => void;
		},
		private wordsProcessed = 0,
		private urlsProcessed = 0
	) {}

	async scrape(urls: string[]) {
		for (const url of urls) {
			this.concurrencyLimiter.call(async () => {
				let html: string;

				try {
					html = await getHTML(url);
				} catch (error) {
					return this.onError({ url, error });
				}

				const $ = cheerio.load(html);

				let urlWords = 0;

				let previousIncompleteText = "";

				const segments: string[] = [];

				$("main *").map((_, elem) => {
					const node = $(elem);

					let text: string;

					if (node.is("p") || node.is("ul")) {
						text = node.text();

						if (!this.elemFilter(node)) return;

						text = text.replaceAll(/[ \t]/g, " ").trim();

						if (text.length === 0) return;

						const elemWords = text.split(" ").length;

						urlWords += elemWords;

						if (elemWords < this.minSegmentWords) {
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

				if (urlWords < this.minUrlWords) {
					this.onTooShort({ url });
					return;
				} else {
					this.onLongEnough({
						url,
						segments,
						title: $("title")
							.text()
							.split("|")[0]!
							.split("-")[0]!
							.trim(),
					});
				}

				this.urlsProcessed++;
				this.wordsProcessed += urlWords;

				if (this.urlsProcessed % this.everyN.n === 0) {
					this.everyN.do({
						urlsProcessed: this.urlsProcessed,
						wordsProcessed: this.wordsProcessed,
					});
				}
			})();
		}
	}
}

export default HTMLScraper;
