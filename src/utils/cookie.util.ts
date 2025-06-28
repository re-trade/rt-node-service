import { Request } from 'express';
import { parse as parseCookie } from 'cookie';
import { JwtTokenType } from '../types/jwt.types.js';

export type JwtCookieMap = Partial<Record<JwtTokenType, string>>;

export function getCookies(req: Request): Record<string, string | undefined> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  return parseCookie(cookieHeader);
}

export function isValidTokenCookieName(name: string): name is JwtTokenType {
  return Object.values(JwtTokenType).includes(name.toUpperCase() as JwtTokenType);
}

export function getCookieMap(req: Request): JwtCookieMap {
  const rawCookies = getCookies(req);
  const result: JwtCookieMap = {};

  for (const [name, value] of Object.entries(rawCookies)) {
    const upperName = name.toUpperCase();
    if (isValidTokenCookieName(upperName) && value) {
      result[upperName as JwtTokenType] = value;
    }
  }

  return result;
}
