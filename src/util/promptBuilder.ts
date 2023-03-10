const promptBuilder = ({
	introduction,
	information,
	context,
}: {
	introduction: string;
	information: { text: string; siteTitle: string }[];
	context: {};
}) => `${introduction}

  Background information:${information.map(
		(info) =>
			`
Title of page containing exerpt: ${info.siteTitle}
Excerpt from page: ${info.text}`
  )}`; // consider appending "Before answering, internally rephrase the question to be clearer if necessary.""

export default promptBuilder;
