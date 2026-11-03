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
console.log("You successfully connected to MongoDB!");

const db = client.db("studio-space");
const facilitiesCollection = db.collection("studios");
const bookingsCollection = db.collection("bookings");


const verifyToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if(!authHeader){
        return res.status(401).send({msg: "Unauthorized!"})
    }

   const token = authHeader.split(" ")[1]

   if(!token){
    return res.status(401).send({msg : "Unauthorized!"});
   }

   const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)) 

   try {
     const {payload} = await jwtVerify(token, JWKS);
     next();
   } catch (error) {
    return res.status(500).send({msg: "Server Error!"});
   }
   
    
}


// ===============================
// ADD STUDIO
// ===============================

app.post("/studios", verifyToken , async (req, res) => {
  try {
    const studioData = req.body;

    const result = await facilitiesCollection.insertOne({
      ...studioData,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "Studio added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add studio" });
  }
});

// ===============================
// GET ALL STUDIOS
// ===============================

app.get("/studios", async (req, res) => {
  try {
    const result = await facilitiesCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch studios" });
  }
});

// ===============================
// GET SINGLE STUDIO
// ===============================

app.get("/studios/:id", verifyToken, async (req, res) => {
    
 const { id } = req.params;
  const result = await facilitiesCollection.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});


// app.patch("/studios/:id", verifyToken, async (req, res) => {
//   const { id } = req.params;
//   const updateData = req.body;

//   const result = await facilitiesCollection.updateOne(
//     { _id: new ObjectId(id) },
//     { $set: updateData }
//   );

//   res.send(result);
// });

app.patch("/studios/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ১. আইডি সঠিক ফরম্যাটে আছে কি না চেক করা
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid studio ID" });
    }

    // ২. স্টুডিওটি ডাটাবেজে আছে কি না চেক করা
    const studio = await facilitiesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    // ৩. আপডেট অপারেশন চালানো
    const result = await facilitiesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.json({
      message: "Studio updated successfully",
      result,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Failed to update studio" });
  }
});

// ===============================
// DELETE STUDIO
// ===============================

app.delete("/studios/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid studio ID" });
    }

    const result = await facilitiesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Studio not found" });
    }

    res.json({
      message: "Studio deleted successfully",
      result,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete studio" });
  }
});

// ===============================
// GET MY STUDIOS
// ===============================

app.get("/my-studios/:email",verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    const result = await facilitiesCollection
      .find({ creatorEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch your studios" });
  }
});

// ===============================
// CREATE BOOKING
// ===============================

app.post("/studios/booking",verifyToken , async (req, res) => {
  try {
    const {
      studioId,
      userEmail,
      bookingDate,
      startTime,
      endTime,
    } = req.body;

    // Required fields validation
    if (
      !studioId ||
      !userEmail ||
      !bookingDate ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "Please provide all booking information",
      });
    }

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(studioId)) {
      return res.status(400).json({
        message: "Invalid studio ID",
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return res.status(400).json({
        message: "Invalid booking date",
      });
    }

    const parsedDate = new Date(`${bookingDate}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== bookingDate
    ) {
      return res.status(400).json({
        message: "Invalid booking date",
      });
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        message: "Invalid booking time",
      });
    }

    // Calculate duration on backend
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    const totalHours = (endMinutes - startMinutes) / 60;

    // Find studio
    const studio = await facilitiesCollection.findOne({
      _id: new ObjectId(studioId),
    });

    if (!studio) {
      return res.status(404).json({
        message: "Studio not found",
      });
    }

    if (!studio.isAvailable) {
      return res.status(400).json({
        message: "This studio is currently unavailable",
      });
    }

    const pricePerHour = Number(studio.pricePerHour);

    if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
      return res.status(400).json({
        message: "Studio hourly price is invalid",
      });
    }

    // Calculate total price on backend
    const totalPrice = totalHours * pricePerHour;

    // Check existing CONFIRMED booking overlap
    const conflictingBooking = await bookingsCollection.findOne({
      studioId,
      bookingDate,
      status: "Confirmed",
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        message:
          "This studio is already booked for the selected time. Please choose another time.",
      });
    }

    // Save booking
    const bookingData = {
      studioId,
      userEmail,
      ownerEmail: studio.creatorEmail || "",
      bookingDate,
      startTime,
      endTime,
      totalHours,
      pricePerHour,
      totalPrice,

      name: studio.name,
      categorySlug: studio.categorySlug,
      description: studio.description,
      image: studio.image,
      location: studio.location,
      capacity: studio.capacity,
      facilities: studio.facilities || [],

      status: "Pending",
      bookedAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(bookingData);

    res.status(201).json({
      message: "Booking request submitted successfully",
      bookingId: result.insertedId,
      booking: bookingData,
    });
  } catch (error) {
    console.error("Booking Error:", error);

    res.status(500).json({
      message: "Failed to create booking",
    });
  }
});

// ===============================
// GET MY BOOKINGS
// ===============================

app.get("/studios/booking/:email",verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    const result = await bookingsCollection
      .find({ userEmail: email })
      .sort({ bookedAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch bookings",
    });
  }
});

// ===============================
// CANCEL PENDING BOOKING
// ===============================

app.patch("/studios/booking/:id/cancel",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        message: "User email is required",
      });
    }

    const result = await bookingsCollection.updateOne(
      {
        _id: new ObjectId(id),
        userEmail,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          cancelledAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Booking not found or it cannot be cancelled",
      });
    }

    res.json({
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel Booking Error:", error);

    res.status(500).json({
      message: "Failed to cancel booking",
    });
  }
});

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.send("StudioSpace Server is Running!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;