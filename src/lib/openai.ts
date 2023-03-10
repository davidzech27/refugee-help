import {
	OpenAIApi,
	Configuration,
	type ChatCompletionRequestMessage,
} from "openai";
import env from "~/env";

const openai = new OpenAIApi(
	new Configuration({
		apiKey: env.OPENAI_SECRET_KEY,
	})
);

export const getFirstCompletion = async ({
	prompt,
	query,
}: {
	prompt: string;
	query: string;
}) => {
	const messages: ChatCompletionRequestMessage[] = [
		{ role: "system", content: prompt },
		{ role: "user", content: query },
	];

	return (
		await openai.createChatCompletion({
			messages,
			model: "gpt-3.5-turbo",
			temperature: 0,
		})
	).data.choices[0]!.message!.content;
};

export const getEmbeddings = async ({ text }: { text: string[] }) => {
	return (
		await openai.createEmbedding({
			input: text,
			model: "text-embedding-ada-002",
		})
	).data.data.map(({ embedding }) => embedding);
};

export const getEmbedding = async ({ text }: { text: string }) => {
	return (
		await openai.createEmbedding({
			input: text,
			model: "text-embedding-ada-002",
		})
	).data.data.map(({ embedding }) => embedding)[0]!;
};

export const getRephrasedQuery = async ({ query }: { query: string }) => {
	return (
		await openai.createChatCompletion({
			messages: [
				{
					role: "system",
					content:
						"Rephrase upon the following question express the user's intent in a clearer manner. Add additional content if necessary to improve the quality and completeness of the question.",
				},
				{ role: "user", content: query },
			],
			model: "gpt-3.5-turbo",
			temperature: 0,
		})
	).data.choices[0]!.message!.content;
};
