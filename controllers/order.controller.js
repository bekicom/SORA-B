const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const axios = require("axios");
const User = require("../models/User");
const Setting = require("../models/settings.model");
const Printer = require("../models/Printer"); // printer modelini ham chaqiramiz

// ✅ Printerga so‘rov yuborish
const printToPrinter = async (data) => {
  try {
    await axios.post(`http://localhost:5000/print`, data, { timeout: 3000 });
    console.log(`✅ Print yuborildi (localhost)`);
  } catch (err) {
    console.error(`❌ Printerga ulanib bo‘lmadi:`, err.message);
  }
};

const createOrder = async (req, res) => {
  try {
    const { table_id, user_id, items, total_price } = req.body;
    console.log(req.body);
    

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Kamida bitta taom kerak" });
    }

    const updatedItems = [];

    for (const item of items) {
      const { food_id, quantity } = item;

      if (!food_id || !quantity) {
        return res.status(400).json({ message: "food_id va quantity kerak" });
      }

      const food = await Food.findById(food_id).populate("category");
      if (!food) {
        return res.status(404).json({ message: `Taom topilmadi: ${food_id}` });
      }

      const category = food.category;
      if (!category || !category.printer_id) {
        return res.status(400).json({ message: `Kategoriya/printer topilmadi: ${food.name}` });
      }

      const printer = await Printer.findById(category.printer_id);

      updatedItems.push({
        food_id,
        name: food.name,
        price: food.price,
        quantity,
        printer_id: category.printer_id,
        printer_ip: printer?.ip || "",
      });
    }

    const newOrder = await Order.create({
      table_id,
      user_id,
      items: updatedItems,
      table_number: req.body.table_number,
      total_price,
      status: "pending",
      waiter_name: req.body.first_name,
    });

    // 🖨️ IP bo‘yicha itemlarni guruhlab yuborish
    const printerOrders = {}; // { ip: [items] }

    for (const item of updatedItems) {
      if (!item.printer_ip) continue;

      if (!printerOrders[item.printer_ip]) {
        printerOrders[item.printer_ip] = [];
      }

      printerOrders[item.printer_ip].push({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      });
    }

    // 🖨️ Har bir printerga alohida chiqarish
    for (const [printerIp, items] of Object.entries(printerOrders)) {
      const payload = {
        table_number: table_id,
        items,
        date: new Date().toLocaleString("uz-UZ"),
      };

      await printToPrinter(printerIp, payload);
    }

    res.status(201).json({
      message: "Zakaz muvaffaqiyatli yaratildi",
      order: newOrder,
    });
  } catch (error) {
    console.error("❌ Zakaz yaratishda xatolik:", error);
    res.status(500).json({ message: "Server xatosi", error: error.message });
  }
};


// ✅ Qolgan funksiyalar o‘zgarmaydi
const getOrdersByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const orders = await Order.find({ table_id: tableId }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Xatolik yuz berdi" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "preparing", "ready", "served"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Noto‘g‘ri status" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Status yangilanishida xatolik" });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await Order.findByIdAndDelete(orderId);
    res.json({ message: "Zakaz o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: "Zakaz o‘chirishda xatolik" });
  }
};

const getBusyTables = async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ["pending", "preparing"] },
    });
    const busyTableIds = orders.map((o) => o.table_id.toString());
    res.json(busyTableIds);
  } catch (err) {
    res.status(500).json({ message: "Stollarni olishda xatolik" });
  }
};

const getMyPendingOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingOrders = await Order.find({
      user_id: userId,
      status: "pending",
    }).sort({ createdAt: -1 });

    res.status(200).json(pendingOrders);
  } catch (error) {
    console.error("Pending orders error:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Zakaz topilmadi" });

    if (order.status === "closed")
      return res.status(400).json({ message: "Zakaz allaqachon yopilgan" });

    const waiter = await User.findById(order.user_id);
    const setting = await Setting.findOne();

    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    const checkData = {
      restaurant_name: setting?.restaurant_name || "Restoran",
      address: setting?.address || "-",
      phone: setting?.phone || "-",
      table_number: order.table_id,
      date: new Date().toLocaleString("uz-UZ"),
      waiter_name: waiter?.first_name || "Afitsant",
      items: order.items,
      total_price: order.total_price,
    };

    res.status(200).json({
      message: "Zakaz yopildi",
      order,
      check: checkData,
    });
  } catch (err) {
    console.error("Zakaz yopishda xatolik:", err);
    res.status(500).json({ message: "Server xatosi", error: err.message });
  }
};

module.exports = {
  createOrder,
  getOrdersByTable,
  updateOrderStatus,
  deleteOrder,
  getBusyTables,
  getMyPendingOrders,
  closeOrder,
};
