import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { NextRequest, NextResponse } from "next/server";
dotenv.config();

const secretKey: string | undefined = process.env.JWT_SECRET_KEY || "";
const refreshSecretKey: string | undefined =
  process.env.REFRESH_SECRET_KEY || "";

export const verifyToken = (token: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    jwt.verify(
      token,
      secretKey || "",
      (err: jwt.VerifyErrors | null, user: object | string | undefined) => {
        if (err) {
          reject("Token verification failed");
        } else {
          if (typeof user === "string") {

            resolve(user);
          } else if (typeof user === "object" && user !== null) {

            resolve(JSON.stringify(user));
          } else {
            reject("Token verification failed: Invalid token format");
          }
        }
      }
    );
  });
};

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, secretKey, { expiresIn: "5h" });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, refreshSecretKey, { expiresIn: "1d" });
};

export const refreshAccessToken = (refreshToken: string): string => {
  var newAccessToken: string = "";
  if (refreshToken !== "" || refreshToken != null) {
    jwt.verify(
      refreshToken,
      refreshSecretKey || "",
      (err: jwt.VerifyErrors | null, decoded: string | object | undefined) => {
        if (err) {
          return NextResponse.json({ error: "Forbidden" });
        } else {
          const userId =
            typeof decoded === "string"
              ? (JSON.parse(decoded) as { userId: string }).userId
              : (decoded as { userId: string })?.userId;
          newAccessToken = generateAccessToken(userId);

          return newAccessToken;
        }
      }
    );
  }
  return newAccessToken;
};
