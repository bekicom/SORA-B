const socketIo = require("socket.io");

// Stol holatini saqlash uchun vaqtinchalik ob'ekt
const tableLocks = {};

// Socket.io ni serverga ulash
const initSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // Stolni band qilish
    socket.on(
      "table_selected",
      ({ tableId, tableName, waiterId, waiterName }) => {
        if (tableLocks[tableId]) {
          // Stol allaqachon band qilingan
          socket.emit("table_conflict", {
            tableId,
            currentOccupier: tableLocks[tableId],
          });
        } else {
          // Stolni band qilish
          tableLocks[tableId] = {
            waiterId,
            waiterName,
            timestamp: new Date(),
            socketId: socket.id,
          };

          // Barcha mijozlarga stol band qilinganligi haqida xabar
          io.emit("table_locked", tableId);

          // Muvaffaqiyatli band qilindi
          socket.emit("table_lock_success", {
            tableId,
            tableName,
            waiterName,
          });

          console.log(`🔒 Stol band qilindi: ${tableId} (${waiterName})`);

          // 5 daqiqadan keyin avtomatik bo'shatish
          setTimeout(() => {
            if (tableLocks[tableId]?.socketId === socket.id) {
              delete tableLocks[tableId];
              io.emit("table_unlocked", tableId);
              console.log(`🔓 Stol avtomatik bo'shatildi: ${tableId}`);
            }
          }, 5 * 60 * 1000);
        }
      }
    );

    // Stolni bo'shatish
    socket.on("table_freed", ({ tableId }) => {
      if (tableLocks[tableId]?.socketId === socket.id) {
        delete tableLocks[tableId];
        io.emit("table_unlocked", tableId);
        console.log(`🔓 Stol bo'shatildi: ${tableId}`);
      }
    });

    // Foydalanuvchi aloqasi uzilishi
    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      // Ushbu socket band qilgan stollarni bo'shatish
      Object.keys(tableLocks).forEach((tableId) => {
        if (tableLocks[tableId]?.socketId === socket.id) {
          delete tableLocks[tableId];
          io.emit("table_unlocked", tableId);
          console.log(`🔓 Stol bo'shatildi (disconnect): ${tableId}`);
        }
      });
    });
  });

  return io;
};

module.exports = initSocket;
