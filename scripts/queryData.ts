import { getDataIndex } from "~/lib/pinecone";
import selectedDataset from "./selectedDataset";
import QueryLoop from "./util/QueryLoop";

const main = async () => {
	const dataIndex = await getDataIndex();

	const queryLoop = new QueryLoop({
		rephraseQueryPrompt: ({ query, previousQuery, previousCompletion }) => {
			if (!previousQuery || !previousCompletion) {
				return `Rephrase the following question express the user's intent in a clearer manner. Add additional content only if necessary to improve the quality completeness of the question. Keep in mind that the user is most likely currently attempting to immigrate to the US. Do not prefix the rephrased query.

Question: ${query}`;
			} else {
				return `Based the user's previous question and answer, rephrase the user's new question express the user's intent in a clearer manner. Add additional content only if necessary to improve the quality and completeness of the question. Keep in mind that the user is most likely currently attempting to immigrate to the US. Do not prefix the rephrased query.

Previous question: ${previousQuery}

Previous answer: ${previousCompletion}

New question: ${query}`;
			}
		},
		completionPrompt: ({ information }) =>
			`You are a very knowledgeable assistant to people with questions about the process of immigrating to the US, who gives extremely useful answers, but avoids a conversational tone. Your answers should be detailed and specific, but concise and easy to understand. Based on the following background information, you will answer the user's question. Ignore information irrelevant to the user's question. There are 2 important considerations to keep in mind while answering users' questions: 1. The user may have a hard time getting access to information themselves, and will rely on the answers you provide to a great extent. 2.  Users are most likely currently attempting to immigrate to the US, so they likely do not have access to very many resources.${information.map(
				(info, infoIndex) =>
					`

${infoIndex}: ${info}`
			)}`,
		transformCompletion: ({ completion, relevantUrls }) => {
			return {
				answer: completion,
				citedUrls: [
					...relevantUrls.reduce(
						(urlSet, url) => new Set([url, ...urlSet]),
						new Set<string>()
					),
				],
			};

			// previously had " It is also absolutely imperative that at the very top of your response, rank the indices corresponding to the information most important to your answer, in a comma-separated list, then followed by a new line." in prompt and following code, but it decreased quality of answers. find another solution sometime
			// 			if (isNaN(Number(completion[0])) || completion[1] !== ",")
			// 				return {
			// 					answer: completion,
			// 					citedUrls: [],
			// 				};

			// 			const splitCompletion = completion.split(`
			// `);
			// 			console.log({ completion, relevantUrls });
			// 			return {
			// 				answer: splitCompletion
			// 					.slice(1)
			// 					.join(
			// 						`
			// `
			// 					)
			// 					.trim(),
			// 				citedUrls: splitCompletion[0]!
			// 					.split(",")
			// 					.map((urlIndexString) => Number(urlIndexString.trim()))
			// 					.filter((number) => !isNaN(number))
			// 					.map((urlIndex) => relevantUrls[urlIndex])
			// 					.filter((url) => typeof url !== "undefined") as string[],
			// 			};
		},
		followUpQuestionsPrompt: ({
			answer,
		}) => `Based on the following answer, suggest a few simple and concise follow-up questions that could be found on the USCIS website, from the perspective of someone that is currently attempting to immigrate to the US, and needs to understand the provided answer. Separate the questions using new lines, and use a dash before each question.".

Answer: ${answer}`,
		numberOfSources: 8,
		dataset: selectedDataset,
		dataIndex,
		transformFollowUpQuestions: ({ followUpQuestions }) =>
			followUpQuestions
				.split(
					`
`
				)
				.filter((followUpQuestion) => followUpQuestion.trim() !== "")
				.map((question) => {
					question = question.replace("-", "").trim();

					if (question.endsWith(",")) {
						question = question.slice(0, question.length - 1);
					}

					return question;
				}),
	});

	await queryLoop.begin();
};

main();
