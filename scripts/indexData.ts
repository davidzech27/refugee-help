import selectedDataset from "./selectedDataset";
import { getEmbeddings } from "~/lib/openai";
import { redis, keys } from "~/lib/redis";
import { upsertSite, getDataIndex } from "~/lib/pinecone";
// potentially parellize if using bigger dataset
const main = async () => {
	const dataIndex = await getDataIndex();

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

		const embeddings = await getEmbeddings({ text: segments });

		await upsertSite(
			{
				url,
				segments: segments.map((segment, segmentIndex) => ({
					text: segment,
					embedding: embeddings[segmentIndex]!,
				})),
				title,
			},
			selectedDataset,
			dataIndex
		);

		console.info(url);
	}

	console.info("Finished");
};

main();
