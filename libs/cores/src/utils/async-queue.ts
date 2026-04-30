export class AsyncQueue {
  private activeCount = 0;
  private readonly queue: (() => void)[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueueSize?: number,
  ) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (
        this.maxQueueSize !== undefined &&
        this.queue.length >= this.maxQueueSize
      ) {
        return reject(new Error('Queue is full'));
      }

      this.queue.push(() => {
        this.activeCount++;
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.activeCount--;
            if (this.queue.length > 0) {
              const next = this.queue.shift();
              next?.();
            }
          });
      });

      if (this.activeCount < this.concurrency) {
        const next = this.queue.shift();
        next?.();
      }
    });
  }
}
