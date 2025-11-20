export function isErrorResponseDto(
  err: unknown,
): err is { message: string; errorCode: number; statusCode: number } {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const candidate = err as Record<string, unknown>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.errorCode === 'number' &&
    typeof candidate.statusCode === 'number'
  );
}
