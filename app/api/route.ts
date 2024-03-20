import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connects from "@/app/database/db";
import { getCache, setCache } from "./redis/redisFunctions";
import UAParser from "ua-parser-js";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let shorturl = url.searchParams.get("id");

    const cacheKey = shorturl;
    let data = await getCache(cacheKey);

    // console.log("Headers:");
    // const headerKeys: any = request.headers.keys();
    // for (const key of headerKeys) {
    //   const value = request.headers.get(key);
    //   console.log(`${key}: ${value}`);
    // }

    let userAgent = request.headers.get("user-agent") || "";
    let userAgentInfo: UAParser.IResult | undefined;
    if (userAgent !== "") {
      userAgentInfo = parseUserAgent(userAgent);
    }


    if (!data) {
      if (shorturl !== null) {
        const con = await connects();

        const db = con.db("url-shortner");

        const urlRef = db.collection("short-urls");

        const p = await urlRef.findOne({
          _id: new ObjectId(shorturl.toString()),
        });

        if (p == null) {
          return NextResponse.json({ message: "No matching documents." });
        }

        const expiry = Number(p.expiresIn);
        const now = Date.now();

        let expirySec = expiry - now;

        if (expirySec <= 0) {
          return NextResponse.json({ message: "Url is expired" });
        }

        expirySec = Math.floor(expirySec / 1000 / 60);

        expirySec = Math.min(900000, expirySec);

        const clicks = p.clicks || [];
        const browser = p.browser || [];
        const devices = p.devices || [];

        clicks.push(Date.now());

        if (userAgentInfo) {
          if (!browser.includes(userAgentInfo.browser.name)) {
            browser.push(userAgentInfo.browser.name);
          }
          if (!devices.includes(userAgentInfo.os.name)) {
            devices.push(userAgentInfo.os.name);
          }
        }

        urlRef
          .findOneAndUpdate(
            { _id: new ObjectId(shorturl.toString()) },
            { $set: { clicks: clicks, devices: devices, browser: browser } }
          )
          .then()
          .catch((error) => {
            console.log(error);
          });

        data = p.OriginalURL;

        setCache(cacheKey, data, expirySec)
          .then(() => {
            console.log("Done");
          })
          .catch((error) => {
            console.log("error: ", error);
          });

        if (!data.startsWith("http://") && !data.startsWith("https://")) {
          data = `https://${url}`;
        }

        return NextResponse.redirect(data);
      } else {
        return NextResponse.json({ message: "Invalid Short url" });
      }
    } else {
      //Async call to insert the clicks into database
      connects()
        .then((con) => {
          const db = con.db("url-shortner");
          const urlRef = db.collection("short-urls");

          if (shorturl !== null) {
            urlRef
              .findOne({ _id: new ObjectId(shorturl.toString()) })
              .then((p) => {
                if (p == null) {
                  console.log("No matching documents.");
                  return NextResponse.json({
                    message: "No matching documents.",
                  });
                }
                const clicks = p.clicks || [];
                const browser = p.browser || [];
                const devices = p.devices || [];

                clicks.push(Date.now());
                if (userAgentInfo) {
                  if (!browser.includes(userAgentInfo.browser.name)) {
                    browser.push(userAgentInfo.browser.name);
                  }
                  if (!devices.includes(userAgentInfo.os.name)) {
                    devices.push(userAgentInfo.os.name);
                  }
                }

                urlRef
                  .findOneAndUpdate(
                    { _id: new ObjectId(shorturl?.toString()) },
                    {
                      $set: {
                        clicks: clicks,
                        devices: devices,
                        browser: browser,
                      },
                    }
                  )
                  .then((result) => {
                    console.log("done");
                  })
                  .catch((err) => {
                    console.error("Error updating document:", err);
                  });
              })
              .catch((err) => {
                console.error("Error finding document:", err);
              });
          } else {
            console.error("Shorturl is not found.");
          }
        })
        .catch((err) => {
          console.error("Error connecting to database:", err);
        });

      return NextResponse.redirect(data);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "error", error: error });
  }
}

function parseUserAgent(userAgentString: string) {
  const parser = new UAParser();
  return parser.setUA(userAgentString).getResult();
}
