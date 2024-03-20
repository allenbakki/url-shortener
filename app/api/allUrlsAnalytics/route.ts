import { NextRequest, NextResponse } from "next/server";
import connects from "@/app/database/db";
import { headers } from "next/headers";
import { verifyToken } from "../tokens/generateTokens";
import { ObjectId } from "mongodb";
import { getCache } from "../redis/redisFunctions";

//an approach when user want to find the analytics of all short-url

export async function GET(req: NextRequest) {
  try {
    const authorization: string | null = headers().get("authorization");

    //token verification
    const tokenPayload = await verifyToken(authorization || "");
    const accessToken = await getCache(authorization);

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

    //creating a index so that can get data for db fastly
    const indexExists = await urlRef.indexExists("createdBy_1");

    if (!indexExists) {
      urlRef
        .createIndex({ createdBy: 1 })
        .then()
        .catch((error) => {
          console.log("error: ", error);
        });
    }

    //find all the docs in short-urls collection created by user
    let urlData = urlRef.find({
      createdBy: user.userId,
    });

    let map1: Map<string, Map<number, number>> = new Map();
    const docData = [];

    //check whether the docs are empty are not
    if (
      (await urlRef.countDocuments({
        createdBy: user.userId,
      })) !== 0
    ) {
      for await (const doc of urlData) {

        console.log("data", doc.clicks.length);
        const clicks = doc.clicks;

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

        const jsonMap: { [dateKey: string]: { [hour: number]: number } } = {};

        map1.forEach((map2, dateKey) => {
          jsonMap[dateKey] = {};
          map2.forEach((clickCount, hour) => {
            jsonMap[dateKey][hour] = clickCount;
          });
        });

        const data = {
          user: user.userId,
          OriginalUrl: doc.OriginalURL,
          shortUrlId: doc.shortUrl,
          ClicksAnalysis: jsonMap,
          TotalClicks: doc.clicks.length,
          deviceType: doc.devices,
          Browsers: doc.browser,
        };

        docData.push(data);
      }
    } else {
      return NextResponse.json({
        user: user.userId,
        Message: "No url exists or the url is expred",
      });
    }

    if (
      (await urlRef.countDocuments({
        createdBy: user.userId,
      })) !== 0
    ) {
      return NextResponse.json({
        data: docData,
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
