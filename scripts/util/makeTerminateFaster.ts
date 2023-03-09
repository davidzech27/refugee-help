import readline from "readline";

const makeTerminateFaster = () => {
	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}
	process.stdin.on("keypress", (_, key) => {
		if (key.ctrl && key.name == "c") {
			process.exit();
		}
	});
};

export default makeTerminateFaster;
