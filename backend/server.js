require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// TEMP DEBUG: remove this in production
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);

const app = express();
connectDB();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/patients", require("./routes/patients"));
app.use("/api/v1/predictive-analysis", require("./routes/assessment"));
app.use("/admin", require("./routes/admin"));
app.use("/api/v1/appointments", require("./routes/appointment"));

app.get("/", (_, res) => res.json({ message: "Pulse Prophet API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
