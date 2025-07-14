const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const mainRoutes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");
const initPrinterServer = require("./utils/printerServer"); // printer serverni import

dotenv.config();

const app = express();
const server = http.createServer(app);

// 🔌 Socket.io sozlamalari
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🧠 Socket hodisalari
io.on("connection", (socket) => {
  console.log("🔌 Yangi ulanish:", socket.id);

  socket.on("table_selected", (tableId) => {
    console.log(`📌 Stol band qilindi: ${tableId}`);
    socket.broadcast.emit("table_locked", tableId);
  });

  socket.on("table_freed", (tableId) => {
    console.log(`✅ Stol bo'shatildi: ${tableId}`);
    socket.broadcast.emit("table_unlocked", tableId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Ulanish uzildi:", socket.id);
  });
});

// ✅ Middleware
app.use(cors());
app.use(express.json());
initPrinterServer(app); // shu joyga qo‘yilishi to‘g‘ri
connectDB();

// ✅ API yo‘llar
app.use("/api", mainRoutes);

// ✅ Printer serverni ishga tushurish

// 🚀 Server ishga tushirish
const PORT = process.env.PORT || 5004;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishlayapti`);
});
