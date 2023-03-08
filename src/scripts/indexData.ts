import * as cheerio from "cheerio";
import readline from "readline";
import chalk from "chalk";
import { scraperApiKey } from "./scraperApiKey";
import { PineconeClient } from "@pinecone-database/pinecone";
import env from "~/env";
import { redis } from "~/lib/redis";
import { OpenAIApi, Configuration } from "openai";
import crypto from "crypto";

const keys = {
  asylumineurope: {
    htmlData: "asylumineuropehtmldata",
  },
  uscis: {
    htmlData: "uscishtmldata",
  },
};

export type PineconeVector = {
  id: string;
  values: number[];
  metadata: { text: string };
};

const main = async () => {
  const pinecone = new PineconeClient();

  const openai = new OpenAIApi(
    new Configuration({
      apiKey: env.OPENAI_SECRET_KEY,
    })
  );

  await pinecone.init({
    environment: env.PINECONE_ENVIRONMENT,
    apiKey: env.PINECONE_API_KEY,
  });

  const index = pinecone.Index(env.PINECONE_INDEX);

  const category = "asylumineurope" satisfies keyof typeof keys;

  let cursor = 0;

  while (true) {
    const result = await redis.sscan(keys[category].htmlData, cursor, {
      count: 100,
    });

    cursor = result[0];

    console.info("Cursor: ", cursor);

    if (cursor === 0) break;

    const segments = result[1] as string[];

    const embeddings = (
      await openai.createEmbedding({
        input: segments,
        model: "text-embedding-ada-002",
      })
    ).data.data.map(({ embedding }) => embedding);

    const vectors: PineconeVector[] = embeddings.map(
      (embedding, embeddingIndex) => ({
        id: crypto
          .createHash("sha256")
          .update(segments[embeddingIndex]!)
          .digest("hex"),
        values: embedding,
        metadata: { text: segments[embeddingIndex]! },
      })
    );

    index.upsert({
      upsertRequest: {
        vectors,
        namespace: category,
      },
    });
  }
};

main();
