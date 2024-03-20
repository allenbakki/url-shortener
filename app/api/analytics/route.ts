import { NextRequest, NextResponse } from "next/server";
import connects from "@/app/database/db";
import { headers } from "next/headers";
import { verifyToken } from "../tokens/generateTokens";
import { Collection, Document, ObjectId } from "mongodb";
import { getCache } from "../redis/redisFunctions";
import { IndexDescription } from "mongodb";

//on demand approach when user want to find the analytics of particular short-url

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    //short url
    let shortUrlId = url.searchParams.get("id");

    const authorization: string | null = headers().get("authorization");
    const accessToken = await getCache(authorization);
    //token verification
    const tokenPayload = await verifyToken(authorization || "");

    //get user id
    const user = JSON.parse(tokenPayload);

    const con = await connects();
    const db = con.db("url-shortner");
    const urlRef = db.collection("short-urls");

    if (!accessToken) {
      const userRef = db.collection("users");

      const userExists = await userRef.findOne({
        _id: new ObjectId(user.userId),
      });

      if (!userExists) {
        return NextResponse.json({ error: "User not Authenticated" });
      }
    }

    const indexName = "shortUrl_createdBy";
    const indexes = await urlRef.indexes();
    const indexAlreadyExists = indexes.some(
      (index) => index.name === indexName
    );

    if (!indexAlreadyExists) {
      const indexResult = await urlRef.createIndex(
        { shortUrl: 1, createdBy: 1 },
        { name: indexName }
      );
    }

    const urlData = await urlRef.findOne({
      shortUrl: shortUrlId,
      createdBy: user.userId,
    });

    let map1: Map<string, Map<number, number>> = new Map();

    if (urlData !== null && urlData.clicks.length > 0) {
      const clicks = urlData.clicks;

      for (let i = 0; i < clicks.length; i++) {
        const date: Date = new Date(clicks[i]);
        const dateKey: string = `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
        const hour: number = date.getHours();
        let map2: Map<number, number>;

        if (map1.has(dateKey)) {
          map2 = map1.get(dateKey)!;
        } else {
          map2 = new Map<number, number>();
          map1.set(dateKey, map2);
        }

        if (map2.has(hour)) {
          map2.set(hour, map2.get(hour)! + 1);
        } else {
          map2.set(hour, 1);
        }
      }
    }

    const jsonMap: { [dateKey: string]: { [hour: number]: number } } = {};

    map1.forEach((map2, dateKey) => {
      jsonMap[dateKey] = {};
      map2.forEach((clickCount, hour) => {
        jsonMap[dateKey][hour] = clickCount;
      });
    });

    if (urlData !== null) {
      return NextResponse.json({
        user: user.userId,
        OriginalUrl: urlData.OriginalURL,
        ClicksAnalysis: jsonMap,
        TotalClicks: urlData.clicks.length,
        deviceType: urlData.devices,
        Browsers: urlData.browser,
      });
    }
    
    else {
      return NextResponse.json({
        user: user.userId,
        Message: "No url exists or the url is expred",
      });
    }
  } catch (err) {
    if (err == "Token verification failed") {
      return NextResponse.json({ error: err, message: "kindly login again" });
    } else {
      return NextResponse.json({ error: "Internal Server Error", err });
    }
  }
}
function indexExists(urlRef: Collection<Document>, indexName: string) {
  throw new Error("Function not implemented.");
}
