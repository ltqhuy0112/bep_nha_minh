import "server-only";

export function logError(message: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(message, error);
  }
}
