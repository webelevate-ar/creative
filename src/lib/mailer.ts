import type { Config } from '../config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Fallback mailer: keeps messages in memory. In development it prints them (links included);
 * in production it only logs that a mail was due, because bodies contain one-time tokens.
 */
export class MemoryMailer implements Mailer {
  sent: Mail[] = [];
  constructor(private readonly log: 'full' | 'redacted' | 'none' = 'full') {}
  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    if (this.sent.length > 100) this.sent.shift();
    if (this.log === 'full') console.log(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    if (this.log === 'redacted') console.warn(`[mail] not sent (no RESEND_API_KEY): subject="${mail.subject}"`);
  }
}

/** Resend HTTP API (https://resend.com). Chosen for a simple fetch-based integration, no SDK. */
export class ResendMailer implements Mailer {
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(mail: Mail): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}`);
  }
}

export function createMailer(config: Config): Mailer {
  if (config.resendApiKey) return new ResendMailer(config.resendApiKey, config.mailFrom);
  if (config.env === 'production') console.warn('[mail] RESEND_API_KEY not set: emails will not be delivered.');
  return new MemoryMailer(config.env === 'development' ? 'full' : config.env === 'production' ? 'redacted' : 'none');
}
