import express from "express"
import cors from "cors"
import { MongoClient } from 'mongodb';
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}

const connectClient = await connectToMongoDB();
const db = connectClient.db("studio-space");
const facilitiesCollection = db.collection("studios");


app.post('/studios', async (req, res) => {
    const studiosData = req.body
    const result = await facilitiesCollection.insertOne(studiosData)
    res.send(result)
})



app.get('/studios', async (req, res) => {
  try {
    const result = await facilitiesCollection.find().toArray();
    res.send( 'kotah koli',result); 
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch facilities", error });
  }
})

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})