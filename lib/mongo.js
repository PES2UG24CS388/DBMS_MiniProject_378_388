import { MongoClient } from 'mongodb';

const g = globalThis;
export async function events() {
  if (!g._mongoClient) g._mongoClient = new MongoClient(process.env.MONGODB_URI).connect();
  const client = await g._mongoClient;
  return client.db(process.env.MONGODB_DB).collection('access_events');
}

// Never let a NoSQL outage break the main request.
export async function logEvent(doc) {
  try {
    const col = await events();
    await col.insertOne({ ts: new Date(), ...doc });
  } catch (e) {
    console.error('Mongo logEvent failed:', e.message);
  }
}
