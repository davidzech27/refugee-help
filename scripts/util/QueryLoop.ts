import readline from "readline";
import OpenAI from "~/lib/openai";
import Pinecone from "~/lib/pinecone";
import { type Dataset } from "~/lib/datasets";
import env from "scripts/env";

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
		query,
	}: {
		answer: string;
		query: string;
	}) => string;
	private readonly transformFollowUpQuestions: ({
		followUpQuestions,
	}: {
		followUpQuestions: string;
	}) => string[];
	private readonly numberOfSources: number;
	private readonly dataset: Dataset;

	constructor({
		rephraseQueryPrompt,
		transformQuery,
		completionPrompt,
		transformCompletion,
		followUpQuestionsPrompt,
		transformFollowUpQuestions,
		numberOfSources,
		dataset,
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
		followUpQuestionsPrompt: ({
			answer,
			query,
		}: {
			answer: string;
			query: string;
		}) => string;
		transformFollowUpQuestions: ({
			followUpQuestions,
		}: {
			followUpQuestions: string;
		}) => string[];
		numberOfSources: number;
		dataset: Dataset;
	}) {
		this.rephraseQueryPrompt = rephraseQueryPrompt;
		this.transformQuery = transformQuery;
		this.completionPrompt = completionPrompt;
		this.transformCompletion = transformCompletion;
		this.followUpQuestionsPrompt = followUpQuestionsPrompt;
		this.transformFollowUpQuestions = transformFollowUpQuestions;
		this.numberOfSources = numberOfSources;
		this.dataset = dataset;
	}

	async begin() {
		const openai = OpenAI({ apiKey: env.OPENAI_SECRET_KEY });
		const pinecone = await Pinecone({
			dataset: this.dataset,
			apiKey: env.PINECONE_API_KEY,
			indexName: env.PINECONE_INDEX,
			environment: env.PINECONE_ENVIRONMENT,
		});

		const queriesAndAnswers: Parameters<typeof openai.getCompletion>[0] =
			[];

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
				query = (
					await openai.getCompletion([
						{
							role: "system",
							content: this.rephraseQueryPrompt({
								query,
								previousQuery:
									queriesAndAnswers.at(-2)?.content,
								previousCompletion:
									queriesAndAnswers.at(-1)?.content,
							}),
						},
					])
				).trim();

				this.transformQuery && (query = this.transformQuery({ query }));

				console.info("Rephrased query:");
				console.info(query);
				console.info();
			} else {
				this.transformQuery && (query = this.transformQuery({ query }));
			}

			queriesAndAnswers.push({ role: "user", content: query });

			const queryEmbedding = await openai.getEmbedding({ text: query });

			const informationMatches = await pinecone.getNearestEmbeddings({
				embedding: queryEmbedding,
				topK: this.numberOfSources,
			});

			const prompt = this.completionPrompt({
				information: informationMatches.map(
					(info) => info.metadata.text
				),
			});

			console.info("Prompt:");
			console.info(prompt);
			console.info();

			const rawCompletion = await openai.getCompletion([
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
				followUpQuestions: await openai.getCompletion([
					{
						role: "system",
						content: this.followUpQuestionsPrompt({
							answer,
							query,
						}),
					},
				]),
			});

			console.info("Cited urls: ");
			for (const citedUrl of citedUrls) {
				console.info(citedUrl);
			}
			console.info();

			console.info("Suggested follow-up questions: ");
			for (const suggestedFollowUpQuestion of suggestedFollowUpQuestions) {
				console.info(suggestedFollowUpQuestion);
			}
		}
	}
}

export default QueryLoop;
