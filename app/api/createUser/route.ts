import { NextRequest, NextResponse } from "next/server";
import connects from "@/app/database/db";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../tokens/generateTokens";
dotenv.config();

interface User {
  email: string | null;
  name: string | null;
  password: string | null;
}

export const POST = async (req: NextRequest, res: NextResponse) => {
  const body = await req.json();

  try {
    if (body === null) {
      NextResponse.json({ error: "Body is null" });
      return;
    }
    let { email, name, password }: User = body;
    if (email == null || name == null || password == null) {
      return NextResponse.json({
        error: "Required all the fields i.e, name,email and password",
      });
    }
    const con = await connects();

    const db = con.db("url-shortner");
    const users = db.collection("users");
    const userExists = await users.findOne({ email: email });

    if (userExists) {
      return NextResponse.json({
        error:
          "User Already Exists, Kindly Login or user another email to create a new account",
      });
    }

    //to hash the password
    let OriginalPassword: String = password;
    const salt = await bcrypt.genSalt(10);
    if (password !== null) {
      password = await bcrypt.hash(password, salt);
    }

    const data = {
      email: email,
      name: name,
      password: password,
      created: Date.now(),
    };

    const p = await users.insertOne(data);

    // Creating a unique token when a user is created
    const accessToken = generateAccessToken(p.insertedId.toString());

    const refreshToken = generateRefreshToken(p.insertedId.toString());

    return NextResponse.json({
      name: name,
      message: "Cretaed user",
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (err) {
    if (err == "Token verification failed") {
      return NextResponse.json({ error: err, message: "kindly login again" });
    } else {
      return NextResponse.json({ error: "Internal Server Error", err });
    }
  }
};
