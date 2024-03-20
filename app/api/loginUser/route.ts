import { NextRequest, NextResponse } from "next/server";
import connects from "@/app/database/db";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../tokens/generateTokens";

import { setCache } from "../redis/redisFunctions";

interface UserLogin {
  email: string | null;
  password: string | null;
}

export const POST = async (req: NextRequest, res: NextResponse) => {
  const body = await req.json();

  try {
    if (body === null) {
      return NextResponse.json({ error: "Body is null" });
    }
    let { email, password }: UserLogin = body;
    if (email == null || password == null || email == "" || password == "") {
      return NextResponse.json({
        error: "Required all the fields i.e, email and password",
      });
    }
    const con = await connects();

    const db = con.db("url-shortner");
    const users = db.collection("users");

    //creating a index so that can get data for db fastly
    const indexExists = await users.indexExists("email_1");

    if (!indexExists) {
      users
        .createIndex({ email: 1 })
        .then()
        .catch((error) => {
          console.log("error: ", error);
        });
    }

    const userExists = await users.findOne({ email: email });

    if (!userExists) {
      return NextResponse.json({ error: "Authentication failed" });
    }

    const passwordMatch = await bcrypt.compare(password, userExists.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Authentication failed" });
    }

    console.log(process.env.JWT_SECRET_KEY);

    const accessToken = generateAccessToken(userExists._id.toString());
    const refreshToken = generateRefreshToken(userExists._id.toString());

    setCache(accessToken, accessToken, 3480)
      .then()
      .catch((error) => {
        console.log(error);
      });

    return NextResponse.json({
      name: userExists.name,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: "Internal Server Error" });
  }
};
