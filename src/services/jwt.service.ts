import jwt, { JwtPayload } from 'jsonwebtoken';
import { JwtTokenType, UserClaims } from '../types/jwt.types.js';
import configLoader from '../configs/config-loader.js';

const getSigningKey = (tokenType: JwtTokenType): string => {
  switch (tokenType) {
    case JwtTokenType.ACCESS_TOKEN:
      return configLoader.config.JWT_SECRET;
    case JwtTokenType.REFRESH_TOKEN:
      return configLoader.config.JWT_SECRET;
    default:
      throw new Error('Unknown token type');
  }
};

const getUserClaimsFromJwt = (token: string, tokenType: JwtTokenType): UserClaims | null => {
  try {
    const key = getSigningKey(tokenType);
    const decoded = jwt.verify(token, key) as JwtPayload;

    if (!decoded || typeof decoded !== 'object' || !decoded.user) {
      return null;
    }

    const user = decoded.user as UserClaims;
    return user;
  } catch (err) {
    return null;
  }
};

const isTokenValid = (token: string, tokenType: JwtTokenType): boolean => {
  try {
    jwt.verify(token, getSigningKey(tokenType));
    return true;
  } catch {
    return false;
  }
};
