export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
  score: 0 | 1 | 2 | 3 | 4;
}

export function checkPassword(password: string, email?: string): PasswordCheck {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("One number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("One symbol");

  const lower = password.toLowerCase();
  if (/(password|qwerty|12345|letmein|admin|welcome|sinnara)/i.test(lower)) {
    errors.push("Cannot contain common words like 'password' or 'admin'");
  }
  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
      errors.push("Cannot contain your email");
    }
  }

  // Score from 0-4 based on passed criteria (length counted twice for very long)
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  return { valid: errors.length === 0, errors, score: clamped };
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l, o
const DIGIT = "23456789"; // no 0, 1
const SYMBOL = "!@#$%^&*-_=+";

function randomFrom(set: string, count: number): string {
  const arr = new Uint32Array(count);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < count; i++) out += set[arr[i] % set.length];
  return out;
}

function shuffle(s: string): string {
  const a = s.split("");
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join("");
}

export function generateStrongPassword(length = 14): string {
  if (length < PASSWORD_MIN_LENGTH) length = PASSWORD_MIN_LENGTH;
  const required =
    randomFrom(UPPER, 2) +
    randomFrom(LOWER, 2) +
    randomFrom(DIGIT, 2) +
    randomFrom(SYMBOL, 2);
  const rest = randomFrom(UPPER + LOWER + DIGIT + SYMBOL, length - required.length);
  return shuffle(required + rest);
}

export const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"] as const;
export const SCORE_COLORS = ["#f87171", "#fb923c", "#facc15", "#a3e635", "#22c55e"] as const;
