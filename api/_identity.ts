export function isValidTrackedUserId(value: string): boolean {
  if (value.length < 3 || value.length > 200) return false;

  if (value.startsWith('guest:')) {
    const suffix = value.slice('guest:'.length);
    return suffix.length >= 3 && /^[A-Za-z0-9._:@$-]+$/.test(suffix);
  }

  return /^[A-Za-z0-9._:@$+-]+$/.test(value);
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (!xForwardedFor) return 'unknown';
  const first = xForwardedFor.split(',')[0]?.trim();
  return first || 'unknown';
}
