// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");

const connectDB = require("./config/db");
const mainRoutes = require("./routes");
const initPrinterServer = require("./utils/printerServer");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Ruxsat berilgan manzillar
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://sora-f.vercel.app",
  "http://192.168.0.101:5173",
];

// ✅ CORS sozlamalari
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS bloklandi: " + origin));
      }
    },
    credentials: true,
  })
);

// ✅ JSON body parser
app.use(express.json());

// ✅ Printer server integratsiyasi
initPrinterServer(app);

// ✅ MongoDB ulanish
connectDB();

// ✅ API router
app.use("/api", mainRoutes);

// 🚀 Serverni ishga tushirish
const PORT = process.env.PORT || 5009;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server ishga tushdi: http://0.0.0.0:${PORT}`);
});
