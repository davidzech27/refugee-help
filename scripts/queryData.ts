import selectedDataset from "./selectedDataset";
import QueryLoop from "./util/QueryLoop";

const main = async () => {
	const queryLoop = new QueryLoop({
		rephraseQueryPrompt: ({ query, previousQuery, previousCompletion }) => {
			if (!previousQuery || !previousCompletion) {
				return `Rephrase the following question express the user's true intent in a clearer manner. Add additional content only if necessary to improve the completeness of the user's question. Keep in mind that the user is most likely currently attempting to immigrate to the US. Do not prefix the rephrased query.

Question: ${query}`;
			} else {
				return `Based the user's previous question and answer, rephrase the user's new question express the user's true intent in a clearer manner. Add additional content only if necessary to improve the completeness of the question. Keep in mind that the user is most likely currently attempting to immigrate to the US. Do not prefix the rephrased query.

Previous question: ${previousQuery}

Previous answer: ${previousCompletion}

New question: ${query}`;
			}
		},
		completionPrompt: ({ information }) =>
			`You are a very knowledgeable assistant to people with questions about the process of immigrating to the US, who gives extremely useful answers, but avoids a conversational tone. Your answers should be specific and detailed, but concise and easy to understand. Based on the following background information, you will answer the user's question. Ignore information irrelevant to the user's question. There are 2 important considerations to keep in mind while answering users' questions: 1. The user may have a hard time getting access to information themselves, and will rely on the answers you provide to a great extent. 2.  Users are most likely currently attempting to immigrate to the US, so they likely do not have access to very many resources.${information.map(
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
		},
		followUpQuestionsPrompt: ({
			answer,
			query,
		}) => `Based on the following initial question and answer, suggest three simple and concise follow-up questions that could be found on the USCIS website, from the perspective of someone that is currently attempting to immigrate to the US, and needs to understand the provided answer. Separate the questions using new lines, and use a dash before each question.".

Initial question: ${query}

Answer: ${answer}`,
		numberOfSources: 8,
		dataset: selectedDataset,
		transformFollowUpQuestions: ({ followUpQuestions }) =>
			followUpQuestions
				.split(
					`
`
				)
				.filter((followUpQuestion) => followUpQuestion.trim() !== "")
				.map((question) => question.replace("-", "").trim()),
	});

	await queryLoop.begin();
};

main();
