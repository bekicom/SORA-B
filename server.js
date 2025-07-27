const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const mainRoutes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");
const initPrinterServer = require("./utils/printerServer");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🆕 Memory'da band stollarni saqlash (production'da Redis ishlatish kerak)
const lockedTables = new Map(); // tableId -> { userId, userName, timestamp }
const userSockets = new Map(); // userId -> socketId

io.on("connection", (socket) => {
  console.log("🔌 Yangi socket ulanish:", socket.id);

  // User ma'lumotlarini socket'ga bog'lash
  socket.on("user_connected", (userData) => {
    const { userId, userName } = userData;
    console.log(`👤 User connected: ${userName} (${userId})`);

    socket.userId = userId;
    socket.userName = userName;
    userSockets.set(userId, socket.id);

    // Hozirgi band stollar ro'yxatini yuborish
    const currentLockedTables = Array.from(lockedTables.keys());
    socket.emit("locked_tables_list", currentLockedTables);
  });

  // Stol tanlanganda (band qilish)
  socket.on("table_selected", (tableId) => {
    const userId = socket.userId;
    const userName = socket.userName || "Noma'lum";

    console.log(
      `📌 Stol band qilinmoqda: ${tableId} by ${userName} (${userId})`
    );

    // Agar stol allaqachon band bo'lsa
    if (lockedTables.has(tableId)) {
      const lockedBy = lockedTables.get(tableId);

      // Agar boshqa user band qilgan bo'lsa
      if (lockedBy.userId !== userId) {
        console.log(
          `❌ Stol allaqachon band: ${tableId} by ${lockedBy.userName}`
        );
        socket.emit("table_lock_failed", {
          tableId,
          message: `Bu stol allaqachon ${lockedBy.userName} tomonidan band qilingan`,
          lockedBy: lockedBy.userName,
          lockedAt: lockedBy.timestamp,
        });
        return;
      }
    }

    // Stolni band qilish
    lockedTables.set(tableId, {
      userId,
      userName,
      timestamp: new Date().toISOString(),
      socketId: socket.id,
    });

    console.log(`✅ Stol band qilindi: ${tableId} by ${userName}`);

    // Boshqa barcha socket'larga xabar yuborish (o'zi bundan mustasno)
    socket.broadcast.emit("table_locked", {
      tableId,
      lockedBy: userName,
      timestamp: new Date().toISOString(),
    });

    // O'zi uchun tasdiqlash
    socket.emit("table_lock_success", {
      tableId,
      message: `Stol muvaffaqiyatli band qilindi: ${tableId}`,
    });
  });

  // Stolni bo'shatish
  socket.on("table_freed", (tableId) => {
    const userId = socket.userId;
    const userName = socket.userName || "Noma'lum";

    console.log(
      `🔓 Stol bo'shatilmoqda: ${tableId} by ${userName} (${userId})`
    );

    // Faqat stol egasi bo'shatishi mumkin
    const lockedInfo = lockedTables.get(tableId);
    if (lockedInfo && lockedInfo.userId === userId) {
      lockedTables.delete(tableId);

      console.log(`✅ Stol bo'shatildi: ${tableId} by ${userName}`);

      // Barcha socket'larga xabar yuborish
      io.emit("table_unlocked", {
        tableId,
        freedBy: userName,
        timestamp: new Date().toISOString(),
      });

      // O'zi uchun tasdiqlash
      socket.emit("table_free_success", {
        tableId,
        message: `Stol muvaffaqiyatli bo'shatildi: ${tableId}`,
      });
    } else {
      console.log(`❌ Stol bo'shatish ruxsati yo'q: ${tableId} by ${userName}`);
      socket.emit("table_free_failed", {
        tableId,
        message: "Bu stolni bo'shatishga ruxsat yo'q",
      });
    }
  });

  // 🆕 Foydalanuvchining barcha stollarini bo'shatish
  socket.on("free_all_my_tables", () => {
    const userId = socket.userId;
    const userName = socket.userName || "Noma'lum";

    console.log(`🧹 ${userName} ning barcha stollari bo'shatilmoqda...`);

    const userTables = [];
    for (const [tableId, lockInfo] of lockedTables.entries()) {
      if (lockInfo.userId === userId) {
        userTables.push(tableId);
        lockedTables.delete(tableId);

        // Har bir stol uchun unlock event
        io.emit("table_unlocked", {
          tableId,
          freedBy: userName,
          timestamp: new Date().toISOString(),
          reason: "user_cleanup",
        });
      }
    }

    if (userTables.length > 0) {
      console.log(
        `✅ ${userName} ning ${userTables.length} ta stoli bo'shatildi:`,
        userTables
      );
      socket.emit("all_tables_freed", {
        tableIds: userTables,
        count: userTables.length,
      });
    }
  });

  // 🆕 Barcha band stollar ro'yxatini olish
  socket.on("get_locked_tables", () => {
    const lockedTablesList = Array.from(lockedTables.entries()).map(
      ([tableId, info]) => ({
        tableId,
        lockedBy: info.userName,
        lockedAt: info.timestamp,
        userId: info.userId,
      })
    );

    socket.emit("locked_tables_list", lockedTablesList);
  });

  // Socket uzilganida barcha stollarni bo'shatish
  socket.on("disconnect", () => {
    const userId = socket.userId;
    const userName = socket.userName || "Noma'lum";

    console.log(`❌ Socket uzildi: ${socket.id} (${userName})`);

    if (userId) {
      userSockets.delete(userId);

      // Bu user'ning barcha stollarini bo'shatish
      const userTables = [];
      for (const [tableId, lockInfo] of lockedTables.entries()) {
        if (lockInfo.userId === userId) {
          userTables.push(tableId);
          lockedTables.delete(tableId);

          // Boshqa socket'larga xabar yuborish
          socket.broadcast.emit("table_unlocked", {
            tableId,
            freedBy: userName,
            timestamp: new Date().toISOString(),
            reason: "disconnect",
          });
        }
      }

      if (userTables.length > 0) {
        console.log(
          `🧹 Disconnect cleanup: ${userName} ning ${userTables.length} ta stoli bo'shatildi:`,
          userTables
        );
      }
    }
  });

  // 🆕 Ping-pong connection check
  socket.on("ping", () => {
    socket.emit("pong");
  });

  // 🆕 Admin uchun - barcha stollarni majburan bo'shatish
  socket.on("admin_force_unlock_all", (adminData) => {
    console.log(`🔓 Admin tomonidan barcha stollar bo'shatilmoqda:`, adminData);

    const allLockedTables = Array.from(lockedTables.keys());
    lockedTables.clear();

    // Barcha socket'larga xabar
    io.emit("all_tables_force_unlocked", {
      adminUser: adminData.userName || "Admin",
      unlockedTables: allLockedTables,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `✅ Admin cleanup: ${allLockedTables.length} ta stol bo'shatildi`
    );
  });

  // 🆕 Zakaz yaratilganda stolni "busy" qilish
  socket.on("order_created", (data) => {
    const { tableId, orderId, orderNumber } = data;
    console.log(`📝 Zakaz yaratildi: ${orderNumber} for table ${tableId}`);

    // Bu stolda zakaz yaratilganini broadcast qilish
    io.emit("table_order_created", {
      tableId,
      orderId,
      orderNumber,
      timestamp: new Date().toISOString(),
    });
  });

  // 🆕 Zakaz yopilganda
  socket.on("order_completed", (data) => {
    const { tableId, orderId, orderNumber } = data;
    console.log(`✅ Zakaz yopildi: ${orderNumber} for table ${tableId}`);

    io.emit("table_order_completed", {
      tableId,
      orderId,
      orderNumber,
      timestamp: new Date().toISOString(),
    });
  });
});

// 🆕 Periodic cleanup - har 30 daqiqada eski lock'larni tozalash
setInterval(() => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  let cleanedCount = 0;
  for (const [tableId, lockInfo] of lockedTables.entries()) {
    const lockTime = new Date(lockInfo.timestamp);
    if (lockTime < thirtyMinutesAgo) {
      console.log(
        `🧹 Eski lock tozalanmoqda: ${tableId} (${lockInfo.userName})`
      );
      lockedTables.delete(tableId);
      cleanedCount++;

      // Cleanup haqida xabar
      io.emit("table_unlocked", {
        tableId,
        freedBy: "System",
        timestamp: new Date().toISOString(),
        reason: "timeout_cleanup",
      });
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Periodic cleanup: ${cleanedCount} ta eski lock tozalandi`);
  }
}, 30 * 60 * 1000); // 30 daqiqa

// Express middleware'lar
app.use(cors());
app.use(express.json());

// Printer server
initPrinterServer(app);

// Database connection
connectDB();

// Routes
app.use("/api", mainRoutes);

// 🆕 Socket info endpoint (debugging uchun)
app.get("/api/socket-info", (req, res) => {
  const lockedTablesList = Array.from(lockedTables.entries()).map(
    ([tableId, info]) => ({
      tableId,
      lockedBy: info.userName,
      lockedAt: info.timestamp,
      userId: info.userId,
      socketId: info.socketId,
    })
  );

  res.json({
    success: true,
    lockedTables: lockedTablesList,
    connectedUsers: Array.from(userSockets.keys()).length,
    totalConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishlayapti`);
  console.log(`🔌 Socket.IO server ishga tushdi`);
  console.log(`📊 Socket info: http://localhost:${PORT}/api/socket-info`);
});
