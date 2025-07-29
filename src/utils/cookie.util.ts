import type { IncomingHttpHeaders } from 'http';
import { parse as parseCookie } from 'cookie';
import { JwtTokenType } from '../types/jwt.types.js';

export type JwtCookieMap = Partial<Record<JwtTokenType, string>>;

function getCookies(req: IncomingHttpHeaders): Record<string, string | undefined> {
  const cookieHeader = req.cookie;
  return cookieHeader ? parseCookie(cookieHeader) : {};
}

function isValidTokenCookieName(name: string): name is JwtTokenType {
  return Object.values(JwtTokenType).includes(name as JwtTokenType);
}

function getCookieMap(req: IncomingHttpHeaders): JwtCookieMap {
  const cookies = getCookies(req);
  const result: JwtCookieMap = {};

  for (const [name, value] of Object.entries(cookies)) {
    const key = name.toUpperCase() as JwtTokenType;
    if (isValidTokenCookieName(key)) {
      result[key] = value;
    }
  }
  return result;
}

export { getCookies, getCookieMap, isValidTokenCookieName };
