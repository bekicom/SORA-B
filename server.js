const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const mainRoutes = require("./routes");
const initPrinterServer = require("./utils/printerServer");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Ruxsat berilgan subdomenlar ro‘yxati
const allowedOrigins = [
  "https://sora.richman.uz", // asosiy subdomen
  "http://localhost:3000", // test uchun (ixtiyoriy)
];

// ✅ Express uchun CORS sozlamasi
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

// ✅ JSON tanib olish
app.use(express.json());

// ✅ Printer server integratsiyasi
initPrinterServer(app);

// ✅ MongoDB ulanish
connectDB();

// ✅ API router
app.use("/api", mainRoutes);

// ✅ Socket.IO server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 🔐 Locked stollar va foydalanuvchi socketlar
const lockedTables = new Map(); // tableId -> { userId, ... }
const userSockets = new Map(); // userId -> socketId

// 🧠 Socket logika
io.on("connection", (socket) => {
  console.log("🔌 Yangi ulanish:", socket.id);

  socket.on("user_connected", ({ userId, userName }) => {
    socket.userId = userId;
    socket.userName = userName;
    userSockets.set(userId, socket.id);
    socket.emit("locked_tables_list", Array.from(lockedTables.keys()));
  });

  socket.on("table_selected", (tableId) => {
    const { userId, userName = "Noma'lum" } = socket;
    if (
      lockedTables.has(tableId) &&
      lockedTables.get(tableId).userId !== userId
    ) {
      return socket.emit("table_lock_failed", {
        tableId,
        message: `Bu stol band: ${lockedTables.get(tableId).userName}`,
      });
    }

    lockedTables.set(tableId, {
      userId,
      userName,
      timestamp: new Date().toISOString(),
      socketId: socket.id,
    });

    socket.broadcast.emit("table_locked", { tableId, lockedBy: userName });
    socket.emit("table_lock_success", { tableId });
  });

  socket.on("table_freed", (tableId) => {
    const { userId, userName = "Noma'lum" } = socket;
    if (lockedTables.get(tableId)?.userId === userId) {
      lockedTables.delete(tableId);
      io.emit("table_unlocked", { tableId, freedBy: userName });
      socket.emit("table_free_success", { tableId });
    } else {
      socket.emit("table_free_failed", { tableId, message: "Ruxsat yo‘q" });
    }
  });

  socket.on("free_all_my_tables", () => {
    const { userId, userName = "Noma'lum" } = socket;
    const userTables = [];

    for (const [tableId, info] of lockedTables.entries()) {
      if (info.userId === userId) {
        userTables.push(tableId);
        lockedTables.delete(tableId);
        io.emit("table_unlocked", { tableId, freedBy: userName });
      }
    }

    socket.emit("all_tables_freed", { tableIds: userTables });
  });

  socket.on("get_locked_tables", () => {
    const lockedList = Array.from(lockedTables.entries()).map(
      ([tableId, info]) => ({
        tableId,
        lockedBy: info.userName,
        lockedAt: info.timestamp,
      })
    );
    socket.emit("locked_tables_list", lockedList);
  });

  socket.on("order_created", ({ tableId, orderId, orderNumber }) => {
    io.emit("table_order_created", { tableId, orderId, orderNumber });
  });

  socket.on("order_completed", ({ tableId, orderId, orderNumber }) => {
    io.emit("table_order_completed", { tableId, orderId, orderNumber });
  });

  socket.on("admin_force_unlock_all", ({ userName = "Admin" }) => {
    const allTables = Array.from(lockedTables.keys());
    lockedTables.clear();
    io.emit("all_tables_force_unlocked", {
      adminUser: userName,
      unlockedTables: allTables,
    });
  });

  socket.on("disconnect", () => {
    const { userId, userName = "Noma'lum" } = socket;
    userSockets.delete(userId);

    for (const [tableId, info] of lockedTables.entries()) {
      if (info.userId === userId) {
        lockedTables.delete(tableId);
        socket.broadcast.emit("table_unlocked", {
          tableId,
          freedBy: userName,
        });
      }
    }
  });
});

// 🔁 Har 30 daqiqada lock tozalash
setInterval(() => {
  const now = Date.now();
  const threshold = now - 30 * 60 * 1000;

  for (const [tableId, info] of lockedTables.entries()) {
    if (new Date(info.timestamp).getTime() < threshold) {
      lockedTables.delete(tableId);
      io.emit("table_unlocked", {
        tableId,
        freedBy: "System",
        reason: "timeout",
      });
    }
  }
}, 30 * 60 * 1000);

// 🔎 Monitoring endpoint
app.get("/api/socket-info", (req, res) => {
  const list = Array.from(lockedTables.entries()).map(([tableId, info]) => ({
    tableId,
    lockedBy: info.userName,
    timestamp: info.timestamp,
  }));

  res.json({
    success: true,
    lockedTables: list,
    usersOnline: userSockets.size,
    totalConnections: io.engine.clientsCount,
  });
});

// ✅ PORT va IP
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server ishga tushdi: http://0.0.0.0:${PORT}`);
});
