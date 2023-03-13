import { Redis as RedisConstructor } from "@upstash/redis";
import type { Dataset } from "./datasets";

const Redis = ({ url, token }: { url: string; token: string }) => {
	return new RedisConstructor({
		url,
		token,
	});
};

export default Redis;

export const keys = {
	asylumineurope: {
		urls: "asylumineurope:urls",
		urlData: ({ url }: { url: string }) => `asylumineurope:urldata:${url}`,
		urlTitle: ({ url }: { url: string }) =>
			`asylumineurope:urltitle:${url}`,
	},
	uscis: {
		urls: "uscis:urls",
		urlData: ({ url }: { url: string }) => `uscis:urldata:${url}`,
		urlTitle: ({ url }: { url: string }) => `uscis:urltitle:${url}`,
	},
} satisfies Record<Dataset, Record<string, string | ((arg: any) => string)>>;
