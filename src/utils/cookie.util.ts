import type { Request } from 'express';
import type { IncomingMessage } from 'http';
import { parse as parseCookie } from 'cookie';
import { JwtTokenType } from '../types/jwt.types.js';

export type JwtCookieMap = Partial<Record<JwtTokenType, string>>;

function getCookies(req: Request | IncomingMessage): Record<string, string | undefined> {
  const cookieHeader = req.headers?.cookie;
  return cookieHeader ? parseCookie(cookieHeader) : {};
}

function isValidTokenCookieName(name: string): name is JwtTokenType {
  return Object.values(JwtTokenType).includes(name as JwtTokenType);
}

function getCookieMap(req: Request | IncomingMessage): JwtCookieMap {
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
