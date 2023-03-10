import readline from "readline";
import {
	getEmbedding,
	getCompletion,
	getRephrasedQuery,
	getSuggestedFollowUpQuestions,
} from "~/lib/openai";
import { getNearestEmbeddings, getDataIndex } from "~/lib/pinecone";
import promptBuilder from "~/util/promptBuilder";
import { type Dataset } from "~/lib/datasets";
import { type PineconeIndex } from "~/lib/pinecone";

class QueryLoop {
	private readonly prompt: ({
		information,
	}: {
		information: string[];
	}) => string;
	private readonly rephraseQueryPrompt?: ({
		query,
	}: {
		query: string;
	}) => string;
	private readonly followUpQuestionsPrompt: ({
		completion,
	}: {
		completion: string;
	}) => string;
	private readonly numberOfSources: number;
	private readonly dataset: Dataset;
	private readonly dataIndex: PineconeIndex;

	constructor({
		prompt,
		rephraseQueryPrompt,
		followUpQuestionsPrompt,
		numberOfSources,
		dataset,
		dataIndex,
	}: {
		prompt: ({ information }: { information: string[] }) => string;
		rephraseQueryPrompt?: ({ query }: { query: string }) => string;
		followUpQuestionsPrompt: ({
			completion,
		}: {
			completion: string;
		}) => string;
		numberOfSources: number;
		dataset: Dataset;
		dataIndex: PineconeIndex;
	}) {
		this.prompt = prompt;
		this.rephraseQueryPrompt = rephraseQueryPrompt;
		this.followUpQuestionsPrompt = followUpQuestionsPrompt;
		this.numberOfSources = numberOfSources;
		this.dataset = dataset;
		this.dataIndex = dataIndex;
	}

	async begin() {
		const queriesAndCompletions: Parameters<typeof getCompletion>[0] = [];

		while (true) {
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

			if (this.rephraseQueryPrompt !== undefined) {
				query = await getCompletion([
					{
						role: "system",
						content: this.rephraseQueryPrompt({ query }),
					},
				]);

				console.info();
				console.info("Rephrased query: " + query);
			}

			queriesAndCompletions.push({ role: "user", content: query });

			const queryEmbedding = await getEmbedding({ text: query });

			const informationMatches = await getNearestEmbeddings({
				embedding: queryEmbedding,
				topK: this.numberOfSources,
				dataset: this.dataset,
				dataIndex: this.dataIndex,
			});

			const prompt = this.prompt({
				information: informationMatches.map(
					(info) => info.metadata.text
				),
			});

			console.info();
			console.info("Prompt: " + prompt);

			const completion = await getCompletion([
				{ role: "system", content: prompt },
				...queriesAndCompletions, // consider using unrephrased query here
			]);

			queriesAndCompletions.push({
				role: "assistant",
				content: completion,
			});

			console.info();
			console.info("Completion: " + completion);

			const suggestedFollowUpQuestions = await getCompletion([
				{
					role: "system",
					content: this.followUpQuestionsPrompt({ completion }),
				},
			]);

			console.info();
			console.info(
				"Suggested follow-up questions: " + suggestedFollowUpQuestions
			);
		}
	}
}

export default QueryLoop;
