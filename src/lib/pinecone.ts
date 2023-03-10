import { PineconeClient } from "@pinecone-database/pinecone";
import type { Dataset } from "./datasets";
import env from "~/env";

export type SiteSegmentVector = {
	id: string;
	values: number[];
	metadata: { text: string; url: string; siteTitle: string };
};

export type PineconeIndex = ReturnType<typeof pinecone.Index>;

const pinecone = new PineconeClient();

export const getDataIndex = async () => {
	await pinecone.init({
		environment: env.PINECONE_ENVIRONMENT,
		apiKey: env.PINECONE_API_KEY,
	});

	if (
		(
			await pinecone.describeIndex({
				indexName: env.PINECONE_INDEX,
			})
		).database === undefined
	) {
		await pinecone.createIndex({
			createRequest: {
				name: env.PINECONE_INDEX,
				dimension: 1536,
				podType: "p1",
				metadataConfig: { indexed: ["url"] },
			},
		});
	}

	return pinecone.Index(env.PINECONE_INDEX);
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

export const upsertSite = async (
	site: {
		url: string;
		title: string;
		segments: { text: string; embedding: number[] }[];
	},
	dataset: Dataset,
	dataIndex: PineconeIndex
) => {
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
};

export const getNearestEmbeddings = async ({
	embedding,
	topK,
	dataIndex,
	dataset,
}: {
	embedding: number[];
	topK: number;
	dataIndex: PineconeIndex;
	dataset: Dataset;
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
};
