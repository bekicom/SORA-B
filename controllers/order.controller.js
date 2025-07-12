const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const axios = require("axios");
const User = require("../models/User");
const Setting = require("../models/settings.model");
// ✅ Printerga so‘rov yuborish
const printToPrinter = async (printerIp, data) => {
  try {
    await axios.post(`http://${printerIp}/print`, data, { timeout: 3000 });
    console.log(`🖨️ Chek yuborildi: ${printerIp}`);
  } catch (err) {
    console.error(`❌ Printerga ulanib bo‘lmadi (${printerIp}):`, err.message);
  }
};

// ✅ Zakaz yaratish
const createOrder = async (req, res) => {
  try {
    const { table_id, user_id, items, total_price } = req.body;

    const grouped = {}; // kategoriyaId: [items]
    const orderItems = [];

    for (const item of items) {
      const food = await Food.findById(item.food_id).populate("category");
      if (!food) continue;

      const itemData = {
        food_id: item.food_id,
        name: food.name,
        price: food.price,
        quantity: item.quantity,
      };

      orderItems.push(itemData);

      const categoryId = food.category._id.toString();
      if (!grouped[categoryId]) grouped[categoryId] = [];
      grouped[categoryId].push(itemData);
    }

    const order = await Order.create({
      table_id,
      user_id,
      items: orderItems,
      total_price,
      status: "pending",
    });

    // Har bir kategoriya bo‘yicha printerni topib, chek chiqaramiz
    for (const [categoryId, groupedItems] of Object.entries(grouped)) {
      const category = await Category.findById(categoryId).populate(
        "printer_id"
      );
      if (!category || !category.printer_id) {
        console.log(`❌ Printer topilmadi: kategoriya ID - ${categoryId}`);
        continue;
      }

      const printerIp = category.printer_id.ip_address;

      console.log(`🖨 Printerga yuborilmoqda: ${printerIp}`);
      console.log(
        `📦 Mahsulotlar:`,
        groupedItems.map((i) => `${i.name} x${i.quantity}`)
      );

 
    }

    res.status(201).json(order);
  } catch (err) {
    console.error("❌ Zakaz yaratishda xatolik:", err);
    res
      .status(500)
      .json({ message: "Zakaz yaratishda xatolik", error: err.message });
  }
};

// ✅ Stol bo‘yicha zakazlarni olish
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

// ✅ Zakaz statusini yangilash
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

// ✅ Zakazni o‘chirish
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await Order.findByIdAndDelete(orderId);
    res.json({ message: "Zakaz o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: "Zakaz o‘chirishda xatolik" });
  }
};

// ✅ Band stollar ro‘yxati
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

// ✅ Foydalanuvchining aktiv zakazlari
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

// ✅ Zakazni yopish
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Zakaz topilmadi" });

    if (order.status === "closed")
      return res.status(400).json({ message: "Zakaz allaqachon yopilgan" });

    // 🔎 Afitsantni topamiz
    const waiter = await User.findById(order.user_id);
    const setting = await Setting.findOne();

    // ✅ Zakazni yopamiz
    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    // ✅ Chek ma'lumotlarini tayyorlash
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

    // 🖨️ Printerga chiqarish (agar kerak bo‘lsa)
    // await printToPrinter(setting?.printer_ip, checkData);

    // ✅ Frontendga chekni qaytaramiz
    res.status(200).json({
      message: "Zakaz yopildi",
      order,
      check: checkData, // frontendda print qilish uchun
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
