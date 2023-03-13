import {
	OpenAIApi,
	Configuration,
	type ChatCompletionRequestMessage,
} from "openai";

const OpenAI = ({ apiKey }: { apiKey: string }) => {
	const openai = new OpenAIApi(
		new Configuration({
			apiKey,
		})
	);

	return {
		getCompletion: async (messages: ChatCompletionRequestMessage[]) => {
			return (
				(await (
					await fetch("https://api.openai.com/v1/chat/completions", {
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						method: "POST",
						body: JSON.stringify({
							messages,
							model: "gpt-3.5-turbo",
							temperature: 0,
						}),
					})
				).json()) as { choices: { message: { content: string } }[] }
			).choices[0]!.message.content;
		},
		getEmbedding: async ({ text }: { text: string }) => {
			return (
				(await (
					await fetch("https://api.openai.com/v1/embeddings", {
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						method: "POST",
						body: JSON.stringify({
							input: text,
							model: "text-embedding-ada-002",
						}),
					})
				).json()) as { data: { embedding: number[] }[] }
			).data.map(({ embedding }) => embedding)[0]!;
		},
		getEmbeddings: async ({ text }: { text: string[] }) => {
			return (
				(await (
					await fetch("https://api.openai.com/v1/embeddings", {
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						method: "POST",
						body: JSON.stringify({
							input: text,
							model: "text-embedding-ada-002",
						}),
					})
				).json()) as { data: { embedding: number[] }[] }
			).data.map(({ embedding }) => embedding);
		},
	};
};

export default OpenAI;
