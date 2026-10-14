/**
 * Supabase sign-in needs an email, so a username stands in for one on a domain this app
 * owns. No mail is ever sent to it. Must match EMAIL_DOMAIN in supabase/functions/setup-login.
 */
const EMAIL_DOMAIN = 'any-stop.vercel.app';

export const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export const cleanUsername = (u: string) => u.trim().toLowerCase();

export const usernameEmail = (u: string) => `${cleanUsername(u)}@${EMAIL_DOMAIN}`;
