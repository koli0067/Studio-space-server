import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from 'mongodb';
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
const facilitiesBookingCollection = db.collection("studiosBooking");

app.post('/studios', async (req, res) => {
    const studiosData = req.body
    const result = await facilitiesCollection.insertOne(studiosData)
    res.send(result)
})

app.get('/studios', async (req, res) => {
 const result = await facilitiesCollection.find().toArray();
    res.send(result);
})


app.get("/studios/:id", async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const result = await facilitiesCollection.findOne({
    _id: new ObjectId(id)
  });

  res.send(result)
  
});

app.post("/studios/booking", async(req, res) => {
    const bookingData = req.body;
    const result = await facilitiesBookingCollection.insertOne(bookingData)
    res.send(result)
})


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})

export default app;