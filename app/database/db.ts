import { MongoClient } from "mongodb";

const url =
  "mongodb+srv://<USERNAME>:<PASSWORD>@cluster0.qjpsf7y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

let client: MongoClient | null = null;

async function connects() {
  try {
    if (client !== null) {
      console.log("Already connected to Atlas");
      return client;
    } else {
      client = new MongoClient(url);
      await client.connect();
      console.log("Successfully connected to Atlas");
      return client;
    }
  } catch (err) {
    console.log(err);
    throw err; 
  }
  
}

export default connects;
