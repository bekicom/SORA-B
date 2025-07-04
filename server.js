const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const mainRoutes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app); // http serverni yaratamiz

// Socket.io ni ulaymiz
const io = new Server(server, {
  cors: {
    origin: "*", // yoki frontend domeningiz
    methods: ["GET", "POST"],
  },
});

// socket hodisalarini kuzatamiz
io.on("connection", (socket) => {
  console.log("🔌 Yangi ulanish:", socket.id);

  // Stol band qilinganida
  socket.on("table_selected", (tableId) => {
    console.log(`📌 Stol band qilindi: ${tableId}`);
    socket.broadcast.emit("table_locked", tableId);
  });

  // Stol bo‘shatilganda
  socket.on("table_freed", (tableId) => {
    console.log(`✅ Stol bo‘shatildi: ${tableId}`);
    socket.broadcast.emit("table_unlocked", tableId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Ulanish uzildi:", socket.id);
    // optional: kerak bo‘lsa avtomatik table unlock qilish
  });
});

// Middleware va routes
app.use(cors());
app.use(express.json());
connectDB();
app.use("/api", mainRoutes);

// Port
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishlayapti`);
});
