import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "qms_access_secret_change_in_prod";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "qms_refresh_secret_change_in_prod";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || "7", 10);

export interface JwtPayload {
  sub: string;
  type: "platform_user" | "company_user" | "customer";
  email: string;
  companyId?: string;
  branchId?: string;
  roles?: string[];
  roleTypes?: string[];
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: `${REFRESH_EXPIRES_DAYS}d`,
    jwtid: crypto.randomBytes(16).toString("hex"),
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS);
  return d;
}
