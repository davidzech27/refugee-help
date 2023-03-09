import { PineconeClient } from "@pinecone-database/pinecone";
import type { Dataset } from "./datasets";
import env from "~/env";

type Namespace = Dataset;

export type ArticleSegmentVector = {
  id: string;
  values: number[];
  metadata: { text: string; url: string; articleTitle: string };
};

const pinecone = new PineconeClient();

await pinecone.init({
  environment: env.PINECONE_ENVIRONMENT,
  apiKey: env.PINECONE_API_KEY,
});

const index = pinecone.Index(env.PINECONE_INDEX);
