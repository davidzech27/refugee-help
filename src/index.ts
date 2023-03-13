import OpenAI from "./lib/openai";
import Pinecone from "./lib/pinecone";
import WhatsApp from "./lib/whatsapp";

interface Env {
	PINECONE_API_KEY: string;
	PINECONE_ENVIRONMENT: string;
	PINECONE_INDEX: string;
	OPENAI_SECRET_KEY: string;
	WHATSAPP_WEBHOOK_TOKEN: string;
	WHATSAPP_PHONE_NUMBER_ID: string;
	META_ACCESS_TOKEN: string;
}

interface MessageWebhookPayload {
	object: "whatsapp_business_account";
	entry: {
		id: string;
		changes: {
			value: {
				messaging_product: "whatsapp";
				metadata: {
					display_phone_number: string;
					phone_number_id: string;
				};
				errors?: {
					code: number;
					title: string;
					message: string;
					error_data: {
						details: string;
					};
				}[];
			} & (
				| {
						contacts: {
							wa_id: string;
							profile: {
								name: string;
							};
						}[];
						messages: ({
							from: string;
							id: string;
							timestamp: string;
							errors?: {
								code: number;
								title: string;
								message: string;
								error_data: {
									details: string;
								};
							}[];
						} & (
							| {
									button: {
										payload: string;
										text: string;
									};
									type: "button";
							  }
							| {
									text: {
										body: string;
									};
									type: "text";
							  }
							| {
									interactive:
										| {
												type: "button_reply";
												button_reply: {
													id: string;
													title: string;
												};
										  }
										| {
												type: "list_reply";
												list_reply: {
													id: string;
													title: string;
													description: string;
												};
										  };
									type: "interactive";
							  }
							| {
									type:
										| "audio"
										| "document"
										| "image"
										| "order"
										| "referral"
										| "sticker"
										| "system"
										| "video"; // data on all other types are ignored
							  }
						))[];
				  }
				| {
						statuses: {
							conversation: {
								id: string;
								origin: {
									type:
										| "business_initiated"
										| "customer_initiated"
										| "referral_conversion";
								};
								expiration_timestamp: string;
							};
							id: string;
							pricing: {
								category:
									| "business_initiated"
									| "customer_initiated"
									| "referral_conversion";
								pricing_model: "CBP";
							};
							recipient_id: string;
							status: "delivered" | "read" | "sent";
							timestamp: string;
							errors?: {
								code: number;
								title: string;
								message: string;
								error_data: {
									details: string;
								};
							}[];
						}[];
				  }
			);
			field: "messages";
		}[];
	}[];
}

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext
	): Promise<Response> {
		if (request.method === "POST") {
			const payload = (await request.json()) as MessageWebhookPayload;

			const value = payload.entry[0]?.changes[0]?.value;

			if (value !== undefined && "messages" in value) {
				const messages = value.messages;

				const message = messages[0];

				if (message !== undefined) {
					let query: string;

					if (message.type === "text") {
						query = message.text.body;
					} else if (
						message.type === "interactive" &&
						message.interactive.type === "button_reply"
					) {
						query = message.interactive.button_reply.id;
					} else {
						return new Response();
					}

					const openai = OpenAI({
						apiKey: env.OPENAI_SECRET_KEY,
					});

					query = (
						await openai.getCompletion([
							{
								role: "system",
								content: `Rephrase the following question express the user's true intent in a clearer manner. Add additional content only if necessary to improve the completeness of the user's question. Keep in mind that the user is most likely currently attempting to immigrate to the US. Do not prefix the rephrased query.

Question: ${query}`,
							},
						])
					).trim();
					console.log({ query });
					const [queryEmbedding, pinecone] = await Promise.all([
						openai.getEmbedding({
							text: query,
						}),
						Pinecone({
							dataset: "uscis",
							apiKey: env.PINECONE_API_KEY,
							indexName: env.PINECONE_INDEX,
							environment: env.PINECONE_ENVIRONMENT,
						}),
					]);

					const informationMatches =
						await pinecone.getNearestEmbeddings({
							embedding: queryEmbedding,
							topK: 7,
						});

					const [information, citedUrls] = [
						informationMatches.map((info) => info.metadata.text),
						[
							...informationMatches
								.map((info) => info.metadata.url)
								.reduce(
									(urlSet, url) => new Set([url, ...urlSet]),
									new Set<string>()
								),
						],
					];
					console.log({ information });
					const answer = (
						await openai.getCompletion([
							{
								role: "system",
								content: `You are a very knowledgeable assistant to people with questions about the process of immigrating to the US, who gives extremely useful answers, but avoids a conversational tone. Your answers should be specific and detailed, but concise and easy to understand. Based on the following background information, you will answer the user's question. Ignore information irrelevant to the user's question. There are 2 important considerations to keep in mind while answering users' questions: 1. The user may have a hard time getting access to information themselves, and will rely on the answers you provide to a great extent. 2.  Users are most likely currently attempting to immigrate to the US, so they likely do not have access to very many resources.${information.map(
									(info, infoIndex) =>
										`

${infoIndex}: ${info}`
								)}`,
							},
							{
								role: "user",
								content: query,
							},
						])
					).replace("Certainly. ", "");

					WhatsApp.sendText({
						fromPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
						toPhoneNumber: message.from,
						body: `${answer}

Sources: ${citedUrls.map(
							(url) => `
${url}`
						)}`,
						metaAccessToken: env.META_ACCESS_TOKEN,
					});

					const followUpQuestions = (
						await openai.getCompletion([
							{
								role: "system",
								content: `Based on the following initial question and answer, suggest three simple and concise follow-up questions that could be found on the USCIS website, from the perspective of someone that is currently attempting to immigrate to the US, and needs to understand the provided answer. Separate the questions using new lines, and use a dash before each question.".

Initial question: ${query}

Answer: ${answer}`,
							},
						])
					)
						.trim()
						.split(
							`
`
						)
						.map((followUpQuestion) =>
							followUpQuestion.replace("-", "").trim()
						);

					WhatsApp.sendButtons({
						fromPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
						toPhoneNumber: message.from,
						body: `Ask another question

1. ${followUpQuestions[0]}
2. ${followUpQuestions[1]}
3. ${followUpQuestions[2]}`,
						buttons: [
							{
								title: "1",
								id: followUpQuestions[0]!,
							},
							{
								title: "2",
								id: followUpQuestions[1]!,
							},
							{
								title: "3",
								id: followUpQuestions[2]!,
							},
						],
						metaAccessToken: env.META_ACCESS_TOKEN,
					});

					return new Response();
				} else {
					return new Response();
				}
			} else {
				return new Response();
			}
		} else if (request.method === "GET") {
			const { searchParams } = new URL(request.url);

			if (
				searchParams.get("hub.mode") === "subscribe" &&
				searchParams.get("hub.verify_token") ===
					env.WHATSAPP_WEBHOOK_TOKEN
			) {
				return new Response(searchParams.get("hub.challenge")); // verify webhook
			} else {
				return new Response(null, { status: 400 });
			}
		} else {
			return new Response(null, { status: 405 });
		}
	},
};
