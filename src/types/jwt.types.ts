export enum JwtTokenType {
  ACCESS_TOKEN = 'ACCESS_TOKEN',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
}

export interface UserClaims {
  username: string;
  roles: string[];
  tokenType: JwtTokenType;
}
