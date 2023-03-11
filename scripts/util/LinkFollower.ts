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

	async follow(initialUrl: string) {
		this.concurrencyLimiter.call(this.followRecursive)(initialUrl, this);
	}

	private async followRecursive(url: string, that: LinkFollower) {
		// why is "this" undefined
		const html = await getHTML(that.urlTransformer(url));

		const $ = cheerio.load(html);

		$("a").map((_, elem) => {
			const node = $(elem);

			let href = node.attr("href");

			if (href === undefined) return;

			if (href.length > 1 && href.at(-1) === "/") {
				href = href.slice(0, href.length - 1);
			}

			const indexOfHashtag = href.indexOf("#");

			if (indexOfHashtag !== -1) {
				href = href.slice(0, indexOfHashtag);
			}

			if (
				!that.urlFilter(href) ||
				href[0] === "#" ||
				href.endsWith(".pdf") ||
				href.endsWith(".xlsx")
			)
				return;

			if (href[0] === "/") {
				href = url.slice(0, url.indexOf("/", 8)) + href;
			}

			if (href.at(-1) === "/") {
				href = href.slice(0, href.length - 1);
			}

			const visitedUrlSetUrl = href
				.replace("https://", "")
				.replace("http://", "");

			if (that.visitedUrlSet.has(visitedUrlSetUrl)) {
				return;
			}

			that.visitedUrlSet.add(visitedUrlSetUrl);

			if (that.visitedUrlSet.size % that.everyN.n === 0) {
				that.everyN.do(that.visitedUrlSet.size);
			}

			(async () => {
				try {
					await that.concurrencyLimiter.call(that.followRecursive)(
						href,
						that
					);

					that.onSuccess({ url: href });
				} catch (error) {
					that.onError({ url: href, error });
				}
			})();
		});
	}
}

export default LinkFollower;
