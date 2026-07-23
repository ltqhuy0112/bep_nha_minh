import bcrypt from "bcryptjs";

const passwordMinLength = 12;
const bcryptCost = 12;

export function validateAdminPassword(password: string) {
  const errors: string[] = [];

  if (password.length < passwordMinLength) {
    errors.push(`Password must be at least ${passwordMinLength} characters.`);
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter.");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter.");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must include a number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a symbol.");
  }

  return errors;
}

export async function hashAdminPassword(password: string) {
  return bcrypt.hash(password, bcryptCost);
}

export async function verifyAdminPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
