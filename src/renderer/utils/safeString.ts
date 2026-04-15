export function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function safeIncludes(value: unknown, needle: string): boolean {
  return safeString(value).includes(needle);
}

export function safeMatch(value: unknown, pattern: RegExp): RegExpMatchArray | null {
  return safeString(value).match(pattern);
}
