import readline from "readline";
import {
	getEmbedding,
	getFirstCompletion,
	getRephrasedQuery,
} from "~/lib/openai";
import { getNearestEmbeddings, getDataIndex } from "~/lib/pinecone";
import selectedDataset from "./selectedDataset";
import promptBuilder from "~/util/promptBuilder";
import { datasetIntroductionPrompts } from "~/lib/datasets";

const REPHRASE_QUERY = true;

const main = async () => {
	const dataIndex = await getDataIndex();

	let query = "";

	process.stdout.write("Query: ");

	const lines = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	for await (const line of lines) {
		query = line;
		break;
	}

	if (REPHRASE_QUERY) {
		query = await getRephrasedQuery({ query });

		console.info();
		console.info("Rephrased query: " + query);
	}

	const queryEmbedding = await getEmbedding({ text: query });

	const informationMatches = await getNearestEmbeddings({
		embedding: queryEmbedding,
		topK: 5,
		dataset: selectedDataset,
		dataIndex,
	});

	const prompt = promptBuilder({
		introduction: datasetIntroductionPrompts[selectedDataset],
		information: informationMatches.map((match) => match.metadata),
		context: {},
	});

	console.info("Prompt: " + prompt);
	console.info();

	const completion = await getFirstCompletion({ prompt, query });

	console.info("Completion: " + completion);
};

main();
