import { neon } from "@neondatabase/serverless";

export function hasDatabaseConfig() {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(
    url &&
      (url.startsWith("postgresql://") ||
        url.startsWith("postgres://"))
  );
}

export function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL není nastavené v .env.local");
  }

  return neon(connectionString);
}

function isRetryableDatabaseError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message} ${String(error.cause ?? "")}`
      : String(error);

  return /fetch failed|network|timeout|timed out|ECONNRESET|ENETUNREACH|EAI_AGAIN|socket/i.test(
    message
  );
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  attempts = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableDatabaseError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  throw lastError;
}
