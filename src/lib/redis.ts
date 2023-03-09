import { Redis } from "@upstash/redis";
import env from "~/env";
import type { Dataset } from "./datasets";

export const redis = new Redis({
	url: env.REDIS_URL,
	token: env.REDIS_TOKEN,
});

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
