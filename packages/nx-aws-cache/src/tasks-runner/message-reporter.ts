import { Logger } from './logger';

export class MessageReporter {
  public error: Error | null = null;

  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
  }

  public printMessages(): void {
    if (!this.error) {
      return;
    }

    this.logger.warn(this.error.message);
  }
}
