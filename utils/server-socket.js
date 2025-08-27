const socketIo = require("socket.io");

// Vaqtinchalik xotira (productionda Redis ishlatish tavsiya etiladi)
const tableLocks = new Map(); // tableId -> { waiterId, waiterName, socketId, timestamp }
const activeOrders = new Map(); // orderId -> orderData
const userSockets = new Map(); // userId -> socketId

function initSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // 🔑 Foydalanuvchi ulanayotganda identifikatsiya
    socket.on("user_connected", ({ userId, userName, role }) => {
      socket.userId = userId;
      socket.userName = userName;
      socket.role = role;

      userSockets.set(userId, socket.id);

      console.log(`👤 ${role} ulandi: ${userName} (${userId})`);

      // Hozirgi holatni unga yuborish
      socket.emit("initial_state", {
        lockedTables: Array.from(tableLocks.entries()),
        activeOrders: Array.from(activeOrders.values()),
      });
    });

    // 🔒 Stolni band qilish
    socket.on("table_lock", ({ tableId, tableName }) => {
      if (tableLocks.has(tableId)) {
        // Stol allaqachon band
        socket.emit("table_conflict", {
          tableId,
          currentOccupier: tableLocks.get(tableId),
        });
        return;
      }

      // Stolni band qilish
      const lockInfo = {
        tableId,
        tableName,
        waiterId: socket.userId,
        waiterName: socket.userName,
        socketId: socket.id,
        timestamp: new Date(),
      };
      tableLocks.set(tableId, lockInfo);

      // Barcha foydalanuvchilarga xabar
      io.emit("table_locked", lockInfo);
      console.log(`🔒 Stol band qilindi: ${tableId} (${socket.userName})`);

      // 5 daqiqadan keyin avtomatik unlock
      setTimeout(() => {
        if (tableLocks.get(tableId)?.socketId === socket.id) {
          tableLocks.delete(tableId);
          io.emit("table_unlocked", { tableId, reason: "timeout" });
          console.log(`⏱ Stol avtomatik bo'shatildi: ${tableId}`);
        }
      }, 5 * 60 * 1000);
    });

    // 🔓 Stolni bo‘shatish
    socket.on("table_unlock", ({ tableId }) => {
      const lockInfo = tableLocks.get(tableId);
      if (lockInfo && lockInfo.socketId === socket.id) {
        tableLocks.delete(tableId);
        io.emit("table_unlocked", { tableId, reason: "manual" });
        console.log(`🔓 Stol bo'shatildi: ${tableId}`);
      }
    });

    // 📦 Zakaz yaratish
    socket.on("order_created", (orderData) => {
      activeOrders.set(orderData.orderId, {
        ...orderData,
        status: "pending",
        createdAt: new Date(),
      });

      io.emit("order_new", orderData);
      console.log(`🆕 Yangi zakaz: ${orderData.orderId}`);
    });

    // 🔄 Zakaz statusini o‘zgartirish
    socket.on("order_update", ({ orderId, newStatus, updatedBy }) => {
      if (activeOrders.has(orderId)) {
        const order = {
          ...activeOrders.get(orderId),
          status: newStatus,
          updatedBy,
          updatedAt: new Date(),
        };

        activeOrders.set(orderId, order);
        io.emit("order_updated", order);

        // Agar zakaz yakunlansa → stol bo‘shatiladi
        if (newStatus === "completed") {
          activeOrders.delete(orderId);
          if (order.tableId && tableLocks.has(order.tableId)) {
            tableLocks.delete(order.tableId);
            io.emit("table_unlocked", {
              tableId: order.tableId,
              reason: "order_completed",
            });
          }
        }
      }
    });

    // ❌ Zakaz bekor qilinganida
    socket.on("order_cancelled", ({ orderId, reason }) => {
      if (activeOrders.has(orderId)) {
        const order = activeOrders.get(orderId);
        activeOrders.delete(orderId);

        io.emit("order_cancelled", {
          orderId,
          tableId: order.tableId,
          reason,
          cancelledBy: socket.userName,
        });

        // Stolni bo‘shatish
        if (order.tableId && tableLocks.has(order.tableId)) {
          tableLocks.delete(order.tableId);
          io.emit("table_unlocked", {
            tableId: order.tableId,
            reason: "order_cancelled",
          });
        }

        console.log(`❌ Zakaz bekor qilindi: ${orderId}`);
      }
    });

    // 🔌 Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ Ulanish tugadi: ${socket.id}`);

      // Bu foydalanuvchiga tegishli stollarni bo'shatish
      for (const [tableId, lockInfo] of tableLocks.entries()) {
        if (lockInfo.socketId === socket.id) {
          tableLocks.delete(tableId);
          io.emit("table_unlocked", {
            tableId,
            reason: "user_disconnected",
          });
        }
      }

      // Foydalanuvchini online ro‘yxatdan chiqarish
      if (socket.userId) {
        userSockets.delete(socket.userId);
      }
    });
  });

  return io;
}

module.exports = initSocket;
