require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
connectDB();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/patients", require("./routes/patients"));
app.use("/risk-assessment", require("./routes/assessment"));
app.use("/admin", require("./routes/admin"));

app.get("/", (_, res) => res.json({ message: "Pulse Prophet API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
