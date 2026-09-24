export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  databasePath: string;
  /** Public base URL, used in emails and to validate the Origin header. */
  baseUrl: string;
  resendApiKey: string | null;
  mailFrom: string;
  /** WhatsApp number (digits) shown for sales/support contact. */
  contactWhatsapp: string | null;
  contactEmail: string;
  /** Max signups per IP per hour (shared NATs: keep it above a handful). */
  signupLimitPerHour: number;
  /** Max login attempts per IP and per email per 15 minutes. */
  loginLimitPer15m: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  const port = Number(env.PORT ?? 3000);
  const baseUrl = (env.BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
  if (mode === 'production' && !env.BASE_URL) throw new Error('BASE_URL is required in production');
  return {
    env: mode,
    port,
    databasePath: env.DATABASE_PATH ?? './data/remarca.sqlite',
    baseUrl,
    resendApiKey: env.RESEND_API_KEY || null,
    mailFrom: env.MAIL_FROM ?? 'Remarcá <hola@remarca.app>',
    contactWhatsapp: env.CONTACT_WHATSAPP?.replace(/\D/g, '') || null,
    contactEmail: env.CONTACT_EMAIL ?? 'hola@remarca.app',
    signupLimitPerHour: Number(env.SIGNUP_LIMIT_PER_HOUR ?? 10),
    loginLimitPer15m: Number(env.LOGIN_LIMIT_PER_15M ?? 10),
  };
}
