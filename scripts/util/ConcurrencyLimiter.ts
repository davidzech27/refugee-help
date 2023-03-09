class ConcurrencyLimiter {
	constructor(
		private readonly maxConcurrency: number,
		private onCompletion: ({
			functionsRunning,
		}: {
			functionsRunning: number;
		}) => void,
		private onZeroConcurrency: () => void,
		private functionCalls = 0,
		private functionCompletions = 0
	) {}

	call<TArgs extends any[]>(fn: (...args: TArgs) => Promise<any>) {
		return async (...args: TArgs) => {
			if (
				this.functionCalls - this.functionCompletions >=
				this.maxConcurrency
			) {
				// suboptimal
				await new Promise((res) => {
					const intervalId = setInterval(() => {
						if (
							this.functionCalls - this.functionCompletions <
							this.maxConcurrency
						) {
							clearInterval(intervalId);

							this.functionCalls++;

							fn(...args).then(res);
						}
					}, 100);
				});
			} else {
				this.functionCalls++;

				await fn(...args);
			}

			this.functionCompletions++;

			const functionsRunning =
				this.functionCalls - this.functionCompletions;

			this.onCompletion({ functionsRunning });

			if (functionsRunning === 0) {
				await new Promise((res) => setTimeout(res, 10000));

				if (functionsRunning !== 0) return;

				this.onZeroConcurrency();
			}
		};
	}
}

export default ConcurrencyLimiter;
