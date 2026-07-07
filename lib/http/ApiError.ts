/**
 * Typed error for v1 handlers/controllers. Thrown from controllers and mapped
 * to a standardized `fail()` response by `withValidation`.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
