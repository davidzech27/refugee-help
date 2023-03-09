import * as cheerio from "cheerio";
import getHTML from "./getHTML";
import ConcurrencyLimiter from "./ConcurrencyLimiter";

class LinkFollower {
	constructor(
		private onSuccess: ({ url }: { url: string }) => void,
		private onError: ({
			url,
			error,
		}: {
			url: string;
			error: unknown;
		}) => void,
		private urlFilter: (url: string) => boolean,
		private urlTransformer: (url: string) => string,
		private concurrencyLimiter: ConcurrencyLimiter,
		private everyN: { n: number; do: (visited: number) => void },
		private visitedUrlSet = new Set<string>()
	) {}

	async follow(url: string) {
		const html = await getHTML(this.urlTransformer(url));

		const $ = cheerio.load(html);

		$("a").map((_, elem) => {
			const node = $(elem);
			let href = node.attr("href");

			if (href === undefined) return;

			if (!this.urlFilter(url) || href[0] === "#") return;

			if (href[0] === "/") {
				href = url.slice(0, url.indexOf("/", 8)) + href;
			}

			if (this.visitedUrlSet.has(href)) {
				return;
			}

			this.visitedUrlSet.add(href);

			if (this.visitedUrlSet.size % this.everyN.n === 0) {
				this.everyN.do(this.visitedUrlSet.size);
			}

			(async () => {
				try {
					await this.concurrencyLimiter.call(this.follow)(href);

					this.onSuccess({ url: href });
				} catch (error) {
					this.onError({ url: href, error });
				}
			})();
		});
	}
}

export default LinkFollower;
