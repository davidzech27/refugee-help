import selectedDataset from "./selectedDataset";
import OpenAI from "~/lib/openai";
import Redis, { keys } from "~/lib/redis";
import Pinecone, { initializePineconeIndex } from "~/lib/pinecone";
import env from "./env";

// potentially parellize if using bigger dataset
const main = async () => {
	await initializePineconeIndex({
		apiKey: env.PINECONE_API_KEY,
		indexName: env.PINECONE_INDEX,
		environment: env.PINECONE_ENVIRONMENT,
	});

	const pinecone = await Pinecone({
		dataset: selectedDataset,
		apiKey: env.PINECONE_API_KEY,
		indexName: env.PINECONE_INDEX,
		environment: env.PINECONE_ENVIRONMENT,
	});

	const redis = Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });

	const openai = OpenAI({ apiKey: env.OPENAI_SECRET_KEY });

	const urls = (
		await redis.scan(0, {
			match: keys[selectedDataset].urlData({ url: "" }) + "*",
			count: 100000,
		})
	)[1].map((key) => key.split(":").slice(2).join(":") as string);

	for (const url of urls) {
		const [segments, title] = await Promise.all([
			redis.smembers(keys[selectedDataset].urlData({ url })),
			redis.get(
				keys[selectedDataset].urlTitle({ url })
			) as Promise<string>,
		]);

		const embeddings = await openai.getEmbeddings({ text: segments });

		await pinecone.upsertSite({
			url,
			segments: segments.map((segment, segmentIndex) => ({
				text: segment,
				embedding: embeddings[segmentIndex]!,
			})),
			title,
		});

		console.info(url);
	}

	console.info("Finished");
};

main();
