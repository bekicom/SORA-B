const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const mainRoutes = require("./routes");

const escpos = require("escpos");
escpos.Network = require("escpos-network");

const Category = require("./models/Category");
const Printer = require("./models/Printer");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ⚡️ Socket.io ulash
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🧠 Socket hodisalar
io.on("connection", (socket) => {
  console.log("🔌 Yangi ulanish:", socket.id);

  socket.on("table_selected", (tableId) => {
    console.log(`📌 Stol band qilindi: ${tableId}`);
    socket.broadcast.emit("table_locked", tableId);
  });

  socket.on("table_freed", (tableId) => {
    console.log(`✅ Stol bo‘shatildi: ${tableId}`);
    socket.broadcast.emit("table_unlocked", tableId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Ulanish uzildi:", socket.id);
  });
});

// 🧩 Middleware
app.use(cors());
app.use(express.json());

// 🌐 MongoDB ulanish
connectDB();
app.use("/api", mainRoutes);

// 🖨 Chek chiqarish — kategoriya asosida printerlarga bo‘lib yuboriladi
app.post("/print", async (req, res) => {
  const { table_number, items, waiter_name } = req.body;

  if (!table_number || !items || !waiter_name) {
    return res.status(400).json({ error: "Maʼlumotlar yetarli emas!" });
  }

  try {
    const itemGroups = {}; // { printerIp: [items...] }

    for (const item of items) {
      const category = await Category.findById(item.category_id).populate(
        "printer_id"
      );

      if (!category || !category.printer_id) continue;

      const printerIp = category.printer_id.ip;

      if (!itemGroups[printerIp]) itemGroups[printerIp] = [];

      itemGroups[printerIp].push(item);
    }

    for (const [printerIp, groupItems] of Object.entries(itemGroups)) {
      const device = new escpos.Network(printerIp);
      const printer = new escpos.Printer(device);

      device.open(() => {
        printer
          .encode("UTF-8")
          .align("CT")
          .size(2, 2)
          .text(`STOL: ${table_number}`)
          .drawLine()
          .size(1, 1)
          .align("LT")
          .text(`Sana: ${new Date().toLocaleString("uz-UZ")}`)
          .text(`Ofitsiant: ${waiter_name}`)
          .drawLine();

        groupItems.forEach((item, idx) => {
          printer.size(1, 1).text(`${idx + 1}. ${item.name}`);
          printer.size(2, 2).style("B").text(`Soni: ${item.quantity}`);
          printer.drawLine();
        });

        printer.align("CT").size(1, 1).text("Zakaz olingan!").cut().close();
      });
    }

    res.json({ message: "✅ Barcha zakazlar printerlarga yuborildi" });
  } catch (err) {
    console.error("❌ Printda xatolik:", err);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

// 🚀 Serverni ishga tushuramiz
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishlayapti`);
});
