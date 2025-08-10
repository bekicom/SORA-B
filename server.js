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

// ✅ Ruxsat berilgan manzillar
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://sora.richman.uz",
  "https://sora-f.vercel.app",
  "http://192.168.0.101:5173",
];

// ✅ Express uchun CORS
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

// ✅ Socket.IO ulanish
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// ✅ Stol va buyurtmalar uchun kolleksiyalar
const lockedTables = new Map(); // tableId -> { userId, ... }
const userSockets = new Map(); // userId -> socketId
const activeOrders = new Map(); // orderId -> orderData

// ✅ Real-time buyurtmalar uchun yangi funksiyalar
function broadcastOrderUpdate(order) {
  io.emit('order_updated', {
    type: 'ORDER_UPDATE',
    order: order,
    timestamp: new Date()
  });
}

function broadcastNewOrder(order) {
  io.emit('new_order', {
    type: 'NEW_ORDER',
    order: order,
    timestamp: new Date()
  });
}

function notifyWaiter(waiterId, message) {
  const socketId = userSockets.get(waiterId);
  if (socketId) {
    io.to(socketId).emit('waiter_notification', message);
  }
}

// ✅ Socket.io connection handlers
io.on("connection", (socket) => {
  console.log("🔌 Yangi ulanish:", socket.id);

  // Foydalanuvchi ulanganda
  socket.on("user_connected", ({ userId, userName, role }) => {
    socket.userId = userId;
    socket.userName = userName;
    socket.role = role;
    
    userSockets.set(userId, socket.id);
    
    // Role'ga qarab roomga qo'shish
    if (role === 'kassir') {
      socket.join('kassir_room');
      console.log(`💰 Kassir ulandi: ${userName} (${userId})`);
    } else if (role === 'ofitsiant') {
      socket.join(`waiter_${userId}`);
      console.log(`🍽️ Ofitsiant ulandi: ${userName} (${userId})`);
    }
    
    // Joriy holatni yuborish
    socket.emit("initial_data", {
      lockedTables: Array.from(lockedTables.entries()).map(([id, data]) => ({
        tableId: id,
        lockedBy: data.userName,
        lockedAt: data.timestamp
      })),
      activeOrders: Array.from(activeOrders.values())
    });
  });



  // Stol bo'shatilganda
  socket.on("table_freed", (tableId) => {
    const { userId } = socket;
    const tableInfo = lockedTables.get(tableId);
    
    if (tableInfo && tableInfo.userId === userId) {
      lockedTables.delete(tableId);
      io.emit("table_unlocked", { 
        tableId, 
        freedBy: tableInfo.userName,
        freedById: userId
      });
    }
  });

  // Yangi buyurtma yaratilganda
  socket.on("order_created", (orderData) => {
    try {
      const { tableId, orderId, waiterId } = orderData;
      
      // Buyurtmani saqlash
      activeOrders.set(orderId, {
        ...orderData,
        status: 'pending',
        createdAt: new Date()
      });
      
      // Barchaga bildirish
      broadcastNewOrder(orderData);
      
      // Ofitsiantga xabar
      notifyWaiter(waiterId, {
        type: 'NEW_ORDER',
        tableId,
        orderId,
        message: `Stol #${tableId} uchun yangi buyurtma`
      });
      
      // Kassirlarga xabar
      io.to('kassir_room').emit('pending_order_added', orderData);
      
    } catch (error) {
      console.error('Buyurtma yaratishda xato:', error);
    }
  });

  // Buyurtma statusi o'zgartirilganda
  socket.on("order_status_changed", ({ orderId, newStatus, changedBy }) => {
    const order = activeOrders.get(orderId);
    if (order) {
      const updatedOrder = {
        ...order,
        status: newStatus,
        updatedAt: new Date(),
        changedBy
      };
      
      activeOrders.set(orderId, updatedOrder);
      broadcastOrderUpdate(updatedOrder);
      
      // Agar buyurtma yakunlangan bo'lsa
      if (newStatus === 'completed') {
        activeOrders.delete(orderId);
        
        // Stolni bo'shatish
        if (order.tableId && lockedTables.has(order.tableId)) {
          lockedTables.delete(order.tableId);
          io.emit("table_unlocked", {
            tableId: order.tableId,
            freedBy: changedBy,
            reason: 'order_completed'
          });
        }
      }
    }
  });

  // Buyurtma bekor qilinganda
  socket.on("order_cancelled", ({ orderId, reason, cancelledBy }) => {
    const order = activeOrders.get(orderId);
    if (order) {
      activeOrders.delete(orderId);
      
      io.emit('order_cancelled', {
        orderId,
        tableId: order.tableId,
        reason,
        cancelledBy,
        timestamp: new Date()
      });
      
      // Stolni bo'shatish
      if (order.tableId && lockedTables.has(order.tableId)) {
        lockedTables.delete(order.tableId);
        io.emit("table_unlocked", {
          tableId: order.tableId,
          freedBy: cancelledBy,
          reason: 'order_cancelled'
        });
      }
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const { userId, userName = "Noma'lum" } = socket;
    if (userId) {
      userSockets.delete(userId);
      
      // Foydalanuvchi stollarini bo'shatish
      for (const [tableId, info] of lockedTables.entries()) {
        if (info.userId === userId) {
          lockedTables.delete(tableId);
          io.emit("table_unlocked", {
            tableId,
            freedBy: "System",
            reason: "user_disconnected"
          });
        }
      }
    }
    console.log(`❌ Ulanish tugatildi: ${socket.id}`);
  });
});

// 🔁 Har 30 daqiqada avtomatik tozalash
setInterval(() => {
  const now = Date.now();
  const threshold = now - 30 * 60 * 1000;

  // Stol locklarini tekshirish
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

  // Eskirgan buyurtmalarni tekshirish
  for (const [orderId, order] of activeOrders.entries()) {
    if (new Date(order.createdAt).getTime() < threshold) {
      activeOrders.delete(orderId);
      io.emit("order_expired", {
        orderId,
        tableId: order.tableId,
        reason: "timeout",
      });
    }
  }
}, 30 * 60 * 1000);

// 🔎 Monitoring endpoint
app.get("/api/socket-info", (req, res) => {
  res.json({
    success: true,
    lockedTables: Array.from(lockedTables.entries()).map(([id, data]) => ({
      tableId: id,
      lockedBy: data.userName,
      lockedById: data.userId,
      lockedAt: data.timestamp
    })),
    activeOrders: Array.from(activeOrders.values()),
    usersOnline: userSockets.size,
    totalConnections: io.engine.clientsCount,
  });
});

// 🚀 Serverni ishga tushirish
const PORT = process.env.PORT || 5009;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server ishga tushdi: http://0.0.0.0:${PORT}`);
});