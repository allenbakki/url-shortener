import { NextRequest, NextResponse } from "next/server";

import { refreshAccessToken } from "../tokens/generateTokens";

import { setCache } from "../redis/redisFunctions";

export const POST = async (req: NextRequest, res: NextResponse) => {
  try {
    const body = await req.json();

    if (body === null) {
      return NextResponse.json({
        error: "Body is null,need refresh Token to refresh acess token",
      });
    }

    const { refreshToken } = body as { refreshToken: string };

    if (refreshToken === null || refreshToken === "") {
      return NextResponse.json({
        error:
          "Refresh token is null,need refresh Token to refresh acess token",
      });
    }

    
      const accessToken = refreshAccessToken(refreshToken);

      if(accessToken!==""){
    setCache(accessToken, accessToken, 3480)
      .then()
      .catch((error) => {
        console.log(error);
      });

    return NextResponse.json({
      message: "Generated access Token",
      accessToken: accessToken,
    });}
    else{
      return NextResponse.json({
        message: "Refresh Token is expired kindly login again!",
        
      });

    }
  } catch (err) {
    console.log(err);
    if (err == "Token verification failed") {
      return NextResponse.json({ error: err, message: "kindly login again" });
    } else {
      return NextResponse.json({ error: "Internal Server Error", err });
    }
  }
};
