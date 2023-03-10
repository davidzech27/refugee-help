export type Dataset = "uscis" | "asylumineurope";

export const datasets = ["uscis", "asylumineurope"] as const;

export const datasetStartingLinks: Record<Dataset, string> = {
	uscis: "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum/obtaining-asylum-in-the-united-states",
	asylumineurope: "https://www.uscis.gov/sitemap",
};
//! engineer these prompts later
export const datasetIntroductionPrompts: Record<Dataset, string> = {
	uscis: 'You are a very knowledgeable assistant to people with questions about the process of immigrating to the US. Based on the following background information, you will answer the user\'s questions. At the end, based on your response, you will suggest 3 follow-up questions that users may have, in the format of "Follow-up questions: ${follow questions}"',
	asylumineurope:
		'You are a very knowledgeable assistant to people with questions about the process of finding asylum in Europe. Based on the following information, you will answer the user\'s questions. At the end, based on your response, you will suggest 3 follow-up questions that the user may have, in the format of "Follow-up questions: ${follow up questions}"',
};
