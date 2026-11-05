import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
console.log("Connected to MongoDB!");

const db = client.db("studio-space");
const facilitiesCollection = db.collection("studios");
const bookingsCollection = db.collection("bookings");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ msg: "Unauthorized!" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).send({ msg: "Unauthorized!" });

  const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  try {
    await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(500).send({ msg: "Server Error!" });
  }
};

// ADD STUDIO
app.post("/studios", verifyToken, async (req, res) => {
  const {
    name, categorySlug, description, image,images, location,
    pricePerHour, securityDeposit, capacity, facilities,
    amenities, isAvailable, creatorEmail, creatorName
  } = req.body;

  const newStudio = {
    name,
    categorySlug,
    description,
    image,
    images: images || [],
    location,
    pricePerHour: Number(pricePerHour),
    securityDeposit: Number(securityDeposit || 0),
    capacity: Number(capacity),
    facilities: facilities || [],
    amenities: amenities || [],
    isAvailable: isAvailable !== undefined ? isAvailable : true,
    creatorEmail,
    creatorName,
    createdAt: new Date(),
  };

  const result = await facilitiesCollection.insertOne(newStudio);
  res.status(201).json({ message: "Studio added successfully", insertedId: result.insertedId });
});

// GET ALL STUDIOS
app.get("/studios", async (req, res) => {
  const result = await facilitiesCollection.find().toArray();
  res.send(result);
});

// verifyToken,

app.get("/studios/:id",  async (req, res) => {
  try {
    const { id } = req.params;

    // কুয়েরি তৈরি করা যা ObjectId এবং সাধারণ স্ট্রিং দুটোই চেক করবে
    let query = { _id: id };
    if (ObjectId.isValid(id) && id.length === 24) {
      query = {
        $or: [
          { _id: new ObjectId(id) },
          { _id: id }
        ]
      };
    }

    const result = await facilitiesCollection.findOne(query);

    if (!result) {
      return res.status(404).json({ message: "Studio not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Get Single Studio Error:", error);
    res.status(500).json({ message: "Failed to fetch studio details" });
  }
});


// UPDATE STUDIO
app.patch("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await facilitiesCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: req.body }
  );
  res.json({ message: "Studio updated successfully", result });
});

// DELETE STUDIO
app.delete("/studios/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await facilitiesCollection.deleteOne({ _id: new ObjectId(id) });
  res.json({ message: "Studio deleted successfully", result });
});

// GET MY STUDIOS
app.get("/my-studios/:email", verifyToken, async (req, res) => {
  const result = await facilitiesCollection.find({ creatorEmail: req.params.email }).toArray();
  res.send(result);
});

app.post("/studios/booking", verifyToken, async (req, res) => {
  try {
    const { studioId, userEmail, bookingDate, startTime, endTime } = req.body;

    let query = { _id: studioId };
    if (ObjectId.isValid(studioId) && studioId.length === 24) {
      query = {
        $or: [{ _id: new ObjectId(studioId) }, { _id: studioId }],
      };
    }

    const studio = await facilitiesCollection.findOne(query);

    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const totalHours = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
    
    if (totalHours <= 0) {
      return res.status(400).json({ message: "Invalid booking duration" });
    }

    const totalPrice = totalHours * Number(studio.pricePerHour);

    const newBooking = {
      studioId,
      userEmail,
      // স্টুডিওর প্রয়োজনীয় সব তথ্য এখানে যুক্ত করে দেওয়া হলো
      name: studio.name,
      categorySlug: studio.categorySlug,
      description: studio.description,
      image: studio.image,
      location: studio.location,
      capacity: studio.capacity,
      pricePerHour: studio.pricePerHour,
      facilities: studio.facilities || [],
      bookingDate,
      startTime,
      endTime,
      totalHours,
      totalPrice,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);

    return res.status(201).json({
      success: true,
      message: "Booking requested successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Booking Creation Error:", error);
    return res.status(500).json({ message: error.message || "Failed to process booking" });
  }
});


// GET MY BOOKINGS
app.get("/studios/booking/:email", verifyToken, async (req, res) => {
  const result = await bookingsCollection.find({ userEmail: req.params.email }).sort({ bookedAt: -1 }).toArray();
  res.send(result);
});

// CANCEL BOOKING
app.patch("/studios/booking/:id/cancel", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;

  await bookingsCollection.updateOne(
    { _id: new ObjectId(id), userEmail, status: "Pending" },
    { $set: { status: "Cancelled", cancelledAt: new Date() } }
  );
  res.json({ message: "Booking cancelled successfully" });
});

app.get("/", (req, res) => {
  res.send("StudioSpace Server is Running!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;