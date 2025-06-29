import {
  CustomerDetailInfo,
  GetCustomerProfileResponse,
  GetSellerProfileResponse,
  GrpcTokenServiceClient,
  SellerDetailInfo,
  TokenRequest,
  TokenType,
  UserTokenInfo,
  VerifyTokenResponse,
} from '../grpc/authentication.js';
import { JwtTokenType } from '../types/jwt.types.js';
import { promisify } from 'util';

type BaseUserInfo = {
  accountId: string;
  roles: string[];
  username: string;
  isActive: boolean;
  isVerified: boolean;
};

type UserTokenResponse = BaseUserInfo & {
  type: JwtTokenType;
};

type CustomerProfileResponse = BaseUserInfo & {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  customerId: string;
  avatarUrl: string;
};

export type SellerProfileResponse = BaseUserInfo & {
  email: string;
  sellerName: string;
  sellerId: string;
  avatarUrl: string;
};

export class AuthService {
  private readonly verifyTokenGrpc: (req: TokenRequest) => Promise<VerifyTokenResponse>;
  private readonly getCustomerGrpc: (req: TokenRequest) => Promise<GetCustomerProfileResponse>;
  private readonly getSellerGrpc: (req: TokenRequest) => Promise<GetSellerProfileResponse>;

  constructor(tokenGrpc: GrpcTokenServiceClient) {
    this.verifyTokenGrpc = promisify(tokenGrpc.verifyToken.bind(tokenGrpc));
    this.getCustomerGrpc = promisify(tokenGrpc.getCustomerProfile.bind(tokenGrpc));
    this.getSellerGrpc = promisify(tokenGrpc.getSellerProfile.bind(tokenGrpc));
  }

  async verifyToken(token: string, tokenType: JwtTokenType): Promise<UserTokenResponse> {
    const response = await this.verifyTokenGrpc({
      token,
      type: this.mapTokenType(tokenType),
    });

    if (!response.isValid || !response.userInfo) {
      throw new Error('Invalid token or user info not returned');
    }

    return this.mapUserInfo(response.userInfo);
  }

  async getCustomerProfile(
    token: string,
    tokenType: JwtTokenType
  ): Promise<CustomerProfileResponse> {
    const response = await this.getCustomerGrpc({
      token,
      type: this.mapTokenType(tokenType),
    });

    if (!response.isValid || !response.userInfo) {
      throw new Error('Invalid token or user info not returned');
    }
    return this.mapCustomerProfileResponse(response.userInfo);
  }

  async getSellerProfile(token: string, tokenType: JwtTokenType): Promise<SellerProfileResponse> {
    const response = await this.getSellerGrpc({
      token,
      type: this.mapTokenType(tokenType),
    });
    if (!response.isValid || !response.userInfo) {
      throw new Error('Invalid token or user info not returned');
    }
    return this.mapSellerProfileResponse(response.userInfo);
  }

  private mapUserInfo(userInfo: UserTokenInfo): UserTokenResponse {
    return {
      roles: userInfo.roles ?? [],
      username: userInfo.username ?? '',
      accountId: userInfo.accountId ?? '',
      isActive: userInfo.isActive ?? false,
      isVerified: userInfo.isVerified ?? false,
      type:
        userInfo.type == TokenType.ACCESS_TOKEN
          ? JwtTokenType.ACCESS_TOKEN
          : JwtTokenType.REFRESH_TOKEN,
    };
  }

  private mapCustomerProfileResponse(userInfo: CustomerDetailInfo): CustomerProfileResponse {
    return {
      roles: userInfo.roles ?? [],
      username: userInfo.username ?? '',
      accountId: userInfo.accountId ?? '',
      isActive: userInfo.isActive ?? false,
      isVerified: userInfo.isVerified ?? false,
      email: userInfo.email ?? '',
      firstName: userInfo.firstName ?? '',
      lastName: userInfo.lastName ?? '',
      phone: userInfo.phone ?? '',
      address: userInfo.address ?? '',
      customerId: userInfo.customerId ?? '',
      avatarUrl: userInfo.avatarUrl ?? '',
    };
  }

  private mapSellerProfileResponse(userInfo: SellerDetailInfo): SellerProfileResponse {
    return {
      roles: userInfo.roles ?? [],
      username: userInfo.username ?? '',
      accountId: userInfo.accountId ?? '',
      isActive: userInfo.isActive ?? false,
      isVerified: userInfo.isVerified ?? false,
      email: userInfo.email ?? '',
      sellerName: userInfo.sellerName ?? '',
      avatarUrl: userInfo.avatarUrl ?? '',
      sellerId: userInfo.sellerId ?? '',
    };
  }

  private mapTokenType(tokenType: JwtTokenType): TokenType {
    return tokenType == JwtTokenType.ACCESS_TOKEN
      ? TokenType.ACCESS_TOKEN
      : TokenType.REFRESH_TOKEN;
  }
}
