class ConcurrencyLimiter {
  constructor(
    private readonly maxConcurrency: number,
    private functionCalls = 0,
    private functionCompletions = 0
  ) {}

  call<TArgs extends any[]>({
    fn,
    onCompletion,
    onZeroConcurrency,
  }: {
    fn: (...args: TArgs) => Promise<any>;
    onCompletion: ({ functionsRunning }: { functionsRunning: number }) => void;
    onZeroConcurrency: () => void;
  }) {
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

      const functionsRunning = this.functionCalls - this.functionCompletions;

      onCompletion({ functionsRunning });

      if (functionsRunning === 0) {
        onZeroConcurrency();
      }
    };
  }
}

export default ConcurrencyLimiter;
