import { pbkdf2 as pbkdf2Callback, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2 = promisify(pbkdf2Callback);

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(plain, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await pbkdf2(plain, salt, 100_000, 64, "sha512");
  const check = derived.toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}
