export interface PlatformLoginDto {
  email: string;
  password: string;
}

export interface CompanyLoginDto {
  email: string;
  password: string;
  companySlug?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface CreatePlatformUserDto {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}
