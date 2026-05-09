require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const { fetchAllPatients } = require("./services/pmsService");

function pickPatientId(record) {
  return (
    record?.patient_id ||
    record?.patientId ||
    record?.id ||
    record?._id ||
    null
  );
}

function pickPatientName(record) {
  return (
    record?.name ||
    [record?.firstName, record?.middleName, record?.lastName].filter(Boolean).join(" ").trim() ||
    "PMS Patient"
  );
}

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    let pmsPatientId = "PH001";
    let pmsPatientName = "Juan Dela Cruz";

    try {
      const patients = await fetchAllPatients();
      if (Array.isArray(patients) && patients.length > 0) {
        const first = patients[0];
        pmsPatientId = pickPatientId(first) || pmsPatientId;
        pmsPatientName = pickPatientName(first) || pmsPatientName;
        console.log(`✅ PMS patient found: ${pmsPatientName} (${pmsPatientId})`);
      } else {
        console.log("⚠️ PMS returned no patients, using fallback patient seed values");
      }
    } catch (pmsErr) {
      console.log("⚠️ PMS fetch failed during seed, using fallback patient seed values");
    }

    await User.deleteMany({
      email: {
        $in: ["patient@pulseprophet.com", "admin@pulseprophet.com"],
      },
    });
    await User.deleteMany({ role: { $nin: ["patient", "admin"] } });
    console.log("🗑️  Cleared old accounts");

    const patientPass = await bcrypt.hash("123456", 10);
    const adminPass = await bcrypt.hash("123456", 10);

    await User.collection.insertMany([
      {
        name: pmsPatientName,
        email: "patient@pulseprophet.com",
        password: patientPass,
        role: "patient",
        patient_id: String(pmsPatientId),
        pms_linked_at: new Date(),
        pms_matched_by: "patient_id",
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
    console.log("✅ Seeded: admin@pulseprophet.com / 123456");
    console.log("🌱 Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
};

seed();
