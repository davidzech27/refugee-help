import readline from "readline";
import { getEmbedding, getCompletion } from "~/lib/openai";
import { getNearestEmbeddings } from "~/lib/pinecone";
import { type Dataset } from "~/lib/datasets";
import { type PineconeIndex } from "~/lib/pinecone";

class QueryLoop {
	private readonly rephraseQueryPrompt?: ({
		query,
		previousQuery,
		previousCompletion,
	}: {
		query: string;
		previousQuery?: string;
		previousCompletion?: string;
	}) => string;
	private readonly transformQuery?: ({ query }: { query: string }) => string;
	private readonly completionPrompt: ({
		information,
	}: {
		information: string[];
	}) => string;
	private readonly transformCompletion: ({
		completion,
		relevantUrls,
	}: {
		completion: string;
		relevantUrls: string[];
	}) => { answer: string; citedUrls: string[] };
	private readonly followUpQuestionsPrompt: ({
		answer,
	}: {
		answer: string;
	}) => string;
	private readonly transformFollowUpQuestions: ({
		followUpQuestions,
	}: {
		followUpQuestions: string;
	}) => string[];
	private readonly numberOfSources: number;
	private readonly dataset: Dataset;
	private readonly dataIndex: PineconeIndex;

	constructor({
		rephraseQueryPrompt,
		transformQuery,
		completionPrompt,
		transformCompletion,
		followUpQuestionsPrompt,
		transformFollowUpQuestions,
		numberOfSources,
		dataset,
		dataIndex,
	}: {
		rephraseQueryPrompt?: ({
			query,
			previousQuery,
			previousCompletion,
		}: {
			query: string;
			previousQuery?: string;
			previousCompletion?: string;
		}) => string;
		transformQuery?: ({ query }: { query: string }) => string;
		completionPrompt: ({
			information,
		}: {
			information: string[];
		}) => string;
		transformCompletion: ({
			completion,
			relevantUrls,
		}: {
			completion: string;
			relevantUrls: string[];
		}) => { answer: string; citedUrls: string[] };
		followUpQuestionsPrompt: ({ answer }: { answer: string }) => string;
		transformFollowUpQuestions: ({
			followUpQuestions,
		}: {
			followUpQuestions: string;
		}) => string[];
		numberOfSources: number;
		dataset: Dataset;
		dataIndex: PineconeIndex;
	}) {
		this.rephraseQueryPrompt = rephraseQueryPrompt;
		this.transformQuery = transformQuery;
		this.completionPrompt = completionPrompt;
		this.transformCompletion = transformCompletion;
		this.followUpQuestionsPrompt = followUpQuestionsPrompt;
		this.transformFollowUpQuestions = transformFollowUpQuestions;
		this.numberOfSources = numberOfSources;
		this.dataset = dataset;
		this.dataIndex = dataIndex;
	}

	async begin() {
		const queriesAndAnswers: Parameters<typeof getCompletion>[0] = [];

		while (true) {
			let query = "";

			console.info("Query: ");

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
						content: this.rephraseQueryPrompt({
							query,
							previousQuery: queriesAndAnswers.at(-2)?.content,
							previousCompletion:
								queriesAndAnswers.at(-1)?.content,
						}),
					},
				]);

				this.transformQuery && (query = this.transformQuery({ query }));

				console.info("Rephrased query:");
				console.info(query);
				console.info();
			} else {
				this.transformQuery && (query = this.transformQuery({ query }));
			}

			queriesAndAnswers.push({ role: "user", content: query });

			const queryEmbedding = await getEmbedding({ text: query });

			const informationMatches = await getNearestEmbeddings({
				embedding: queryEmbedding,
				topK: this.numberOfSources,
				dataset: this.dataset,
				dataIndex: this.dataIndex,
			});

			const prompt = this.completionPrompt({
				information: informationMatches.map(
					(info) => info.metadata.text
				),
			});

			console.info("Prompt:");
			console.info(prompt);
			console.info();

			const rawCompletion = await getCompletion([
				{ role: "system", content: prompt },
				...queriesAndAnswers, // consider using unrephrased query here
			]);

			const { answer, citedUrls } = this.transformCompletion({
				completion: rawCompletion,
				relevantUrls: informationMatches.map(
					(info) => info.metadata.url
				),
			});

			queriesAndAnswers.push({
				role: "assistant",
				content: answer,
			});

			console.info("Answer:");
			console.info(answer);
			console.info();

			const suggestedFollowUpQuestions = this.transformFollowUpQuestions({
				followUpQuestions: await getCompletion([
					{
						role: "system",
						content: this.followUpQuestionsPrompt({ answer }),
					},
				]),
			});

			console.info("Cited urls: ");

			console.info();

			console.info("Suggested follow-up questions: ");
			for (const suggestedFollowUpQuestion of suggestedFollowUpQuestions) {
				console.info(suggestedFollowUpQuestion);
			}
		}
	}
}

export default QueryLoop;
