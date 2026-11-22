/** Google accounts allowed into the web chat (login and every protected route). */
export const ALLOWED_EMAILS = ["arditnwork@gmail.com"];

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}
