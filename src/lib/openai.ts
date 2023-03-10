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

export const getCompletion = async (
	messages: ChatCompletionRequestMessage[]
) => {
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
