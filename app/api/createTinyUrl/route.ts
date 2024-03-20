import { NextRequest, NextResponse } from "next/server";
import connects from "../../database/db";
import { headers } from "next/headers";
import { verifyToken } from "../tokens/generateTokens";
import { ObjectId } from "mongodb";
import { getCache } from "../redis/redisFunctions";

const BaseUrl = "http://localhost:3000/api";

export async function POST(req: NextRequest) {
  try {
    const authorization: string | null = headers().get("authorization");
    console.log(authorization);

    const body = await req.json();
    console.log(body);
    let { url } = body as { url: string };

    if (url == null || url == "") {
      return NextResponse.json({
        error: "Require url to convert it into short-url",
      });
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    console.log("url", url);
    if (!isValidURL(url)) {
      return NextResponse.json({
        error: "Kindly check the url ,it is not proper format ",
      });
    }

    const tokenPayload = await verifyToken(authorization || "");
    console.log("tokem", typeof tokenPayload);

    const accessToken = await getCache(authorization);

    const user = JSON.parse(tokenPayload);
    console.log(user.userId);

    const con = await connects();

    const db = con.db("url-shortner");

    if (!accessToken) {
      const users = db.collection("users");

      const userExists = await users.findOne({
        _id: new ObjectId(user.userId),
      });

      console.log(userExists);
      if (!userExists) {
        return NextResponse.json({ error: "User not Authenticated" });
      }
    }
    const urlRef = db.collection("short-urls");

    const created = Date.now();
    console.log("cretaed", created);

    const expiresIn = created + 30 * 24 * 60 * 60 * 1000;
    console.log("expire", expiresIn);

    const data = {
      OriginalURL: url,
      clicks: [],
      referalSource: [],
      created: created,
      createdBy: user.userId,
      expiresIn: expiresIn,
    };

    const p = await urlRef.insertOne(data);
    console.log("p", p);
    const indexExists = await urlRef.indexExists("expiresIn_1");

    if (!indexExists) {
      const expiresInInSeconds = (expiresIn - created) / 1000;

      urlRef
        .createIndex(
          { expiresIn: 1 },
          { expireAfterSeconds: expiresInInSeconds }
        )
        .then()
        .catch((error) => {
          console.log("error: ", error);
        });
    }

    urlRef
      .findOneAndUpdate(
        { _id: p.insertedId },
        { $set: { shortUrl: p.insertedId.toString() } }
      )
      .then((res) => {
        console.log("Done");
      })
      .catch((error) => {
        console.log(error);
      });

    return NextResponse.json(`${BaseUrl}?id=${p.insertedId.toString()}`);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "error", error: error });
  }
}

//to check the tld (top-level-domain) for the url
function isValidURL(url: string): boolean {
  const domain = new URL(url).hostname;
  return /\.[a-zA-Z]{2,}$/.test(domain);
}
