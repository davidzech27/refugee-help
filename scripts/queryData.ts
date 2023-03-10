import readline from "readline";
import {
	getEmbedding,
	getRephrasedQuery,
	getSuggestedFollowUpQuestions,
} from "~/lib/openai";
import { getNearestEmbeddings, getDataIndex } from "~/lib/pinecone";
import selectedDataset from "./selectedDataset";
import promptBuilder from "~/util/promptBuilder";
import { datasetIntroductionPrompts } from "~/lib/datasets";
import QueryLoop from "./util/QueryLoop";

const main = async () => {
	const dataIndex = await getDataIndex();

	const queryLoop = new QueryLoop({
		prompt: ({
			information,
		}) => `You are a very knowledgeable assistant to people with questions about the process of immigrating to the US, who gives extremely useful answers. Based on the following background information, you will answer the user's question. Keep in mind that the user may have a hard time getting access to information themselves, and will rely on the answers you provide to a great extent.

${information.map(
	(info, infoIndex) =>
		`
					
${infoIndex + 1}: ${info}`
)}`,
		rephraseQueryPrompt: ({ query }) =>
			`Rephrase upon the following question express the user's intent in a clearer manner. Add additional content if necessary to improve the quality and completeness of the question.

Question: ${query}`,
		followUpQuestionsPrompt: ({
			completion,
		}) => `Based on the following answer, suggest a few follow-up questions from the perspective of someone that is attempting to immigrate to the US. Use phrases from the answer. Separate the questions using 2 newlines, and don't use any dashes.

Answer: ${completion}`,
		numberOfSources: 5,
		dataset: selectedDataset,
		dataIndex,
	});

	await queryLoop.begin();
};

main();
