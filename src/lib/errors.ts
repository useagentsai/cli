export class ApiError extends Error {
  constructor(
    message: string,
    readonly code = "API_ERROR",
    readonly status?: number,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class CliError extends Error {
  constructor(message: string, readonly code = "INVALID_ARGUMENT") {
    super(message);
    this.name = "CliError";
  }
}

export function errorDetails(error: unknown): { message: string; code: string; exitCode: number } {
  if (error instanceof ApiError || error instanceof CliError) {
    const hint = error instanceof ApiError ? error.hint : undefined;
    return { message: hint ? `${error.message} ${hint}` : error.message, code: error.code, exitCode: 1 };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Request timed out.", code: "TIMEOUT", exitCode: 1 };
  }
  return { message: "An unexpected error occurred.", code: "UNEXPECTED_ERROR", exitCode: 2 };
}
