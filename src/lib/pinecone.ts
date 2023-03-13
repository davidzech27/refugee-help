import { PineconeClient } from "@pinecone-database/pinecone";
import type { Dataset } from "./datasets";

export type SiteSegmentVector = {
	id: string;
	values: number[];
	metadata: { text: string; url: string; siteTitle: string };
};

export type PineconeIndex = ReturnType<typeof pinecone.Index>;

const pinecone = new PineconeClient();

export const initializePineconeIndex = async ({
	apiKey,
	indexName,
	environment,
}: {
	apiKey: string;
	indexName: string;
	environment: string;
}) => {
	await pinecone.init({
		environment,
		apiKey,
	});

	try {
		if (
			(
				await pinecone.describeIndex({
					indexName,
				})
			).database === undefined
		) {
			throw new Error();
		}
	} catch {
		await pinecone.createIndex({
			createRequest: {
				name: indexName,
				dimension: 1536,
				podType: "p1",
				metadataConfig: { indexed: ["url"] },
			},
		});
	}
};

const Pinecone = async ({
	apiKey,
	indexName,
	environment,
	dataset,
}: {
	apiKey: string;
	indexName: string;
	environment: string;
	dataset: Dataset;
}) => {
	await pinecone.init({
		environment,
		apiKey,
	});

	const dataIndex = pinecone.Index(indexName);

	return {
		upsertSite: async (site: {
			url: string;
			title: string;
			segments: { text: string; embedding: number[] }[];
		}) => {
			const vectors: SiteSegmentVector[] = site.segments.map(
				(segment, segmentIndex) => ({
					id: serializeId({ url: site.url, segmentIndex }),
					values: segment.embedding,
					metadata: {
						text: segment.text,
						url: site.url,
						siteTitle: site.title,
					},
				})
			);

			await dataIndex.upsert({
				upsertRequest: {
					namespace: dataset,
					vectors,
				},
			});
		},
		getNearestEmbeddings: async ({
			embedding,
			topK,
		}: {
			embedding: number[];
			topK: number;
		}) => {
			return (
				await dataIndex.query({
					queryRequest: {
						topK,
						includeMetadata: true,
						namespace: dataset,
						vector: embedding,
					},
				})
			).matches as SiteSegmentVector[];
		},
	};
};

const serializeId = ({
	url,
	segmentIndex,
}: {
	url: string;
	segmentIndex: number;
}) => `${segmentIndex}::${url}`;

const deserializeId = (id: string) => {
	const [segmentIndex, url] = id.split("::");

	return { segmentIndex, url };
};

export default Pinecone;
