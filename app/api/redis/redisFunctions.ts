import { RedisCommandArgument } from "@redis/client/dist/lib/commands";
import { createClient } from "redis";

// Initialize Redis client
const redisClient = createClient({ url: "redis://localhost:6379" });
redisClient.on("error", (err) => console.log("Redis Client Error", err));

export default redisClient;

export async function getCache(key: any) {
  await redisClient.connect();
  const data = await redisClient.get(key);
  await redisClient.quit();
  return data ? JSON.parse(data) : null;
}

export async function setCache(key: any, value: String, expiry: number) {
  await redisClient.connect();
  const result = await redisClient.setEx(key, expiry, JSON.stringify(value));
  await redisClient.quit();
  return result;
}
