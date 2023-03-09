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
    data: "asylumineurope:data",
  },
  uscis: {
    urls: "uscis:urls",
    data: "uscis:data",
  },
} satisfies Record<Dataset, Record<string, string>>;
