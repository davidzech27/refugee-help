const getHTML = async (url: string) => {
	const response = (await fetch(url)).body!.getReader();

	let html = "";

	while (true) {
		const chunk = await response.read();
		if (chunk.done) break;
		html += Buffer.from(chunk.value).toString("utf8");
	}

	return html;
};

export default getHTML;
