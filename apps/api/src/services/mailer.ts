import type { Logger } from '../config/logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Outbound email boundary. A real provider (SES, Postmark, ...) plugs in behind this interface. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Development mailer that writes messages to the log instead of sending them. */
export function createLogMailer(logger: Logger): Mailer {
  return {
    send(message) {
      logger.info({ mail: message }, `Email to ${message.to}: ${message.subject}`);
      return Promise.resolve();
    },
  };
}
