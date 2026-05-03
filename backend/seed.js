require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await User.deleteMany({
      email: {
        $in: ["patient@pulseprophet.com", "doctor@pulseprophet.com", "admin@pulseprophet.com"],
      },
    });
    console.log("🗑️  Cleared old accounts");

    const patientPass = await bcrypt.hash("123456", 10);
    const staffPass = await bcrypt.hash("123456", 10);
    const adminPass = await bcrypt.hash("123456", 10);

    await User.collection.insertMany([
      {
        name: "Juan Dela Cruz",
        email: "patient@pulseprophet.com",
        password: patientPass,
        role: "patient",
        patient_id: "PH001",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Dr. Maria Reyes",
        email: "doctor@pulseprophet.com",
        password: staffPass,
        role: "staff",
        patient_id: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Admin Aquino",
        email: "admin@pulseprophet.com",
        password: adminPass,
        role: "admin",
        patient_id: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    console.log("✅ Seeded: patient@pulseprophet.com / 123456");
    console.log("✅ Seeded: doctor@pulseprophet.com / 123456");
    console.log("✅ Seeded: admin@pulseprophet.com / 123456");
    console.log("🌱 Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
};

seed();
