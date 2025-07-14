const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const User = require("../models/User");
const Setting = require("../models/settings");
const Printer = require("../models/Printer");
const axios = require("axios");

// 🖨️ Print server orqali yuborish (sizning eski kodingiz)
const printToPrinter = async (printerIp, data) => {
  try {
    console.log(
      `🖨️ Print yuborilmoqda (${printerIp}):`,
      JSON.stringify(data, null, 2)
    );

    // Sizning print server endpoint ingizga yuborish
    const response = await axios.post(
      `http://localhost:5000/print`,
      {
        ...data,
        printerIp: printerIp, // Printer IP ni qo'shish
      },
      {
        timeout: 8000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Print muvaffaqiyatli yuborildi (${printerIp})`);
    return { success: true, response: response.data };
  } catch (err) {
    console.error(`❌ ${printerIp} printerga ulanib bo'lmadi:`, err.message);
    return { success: false, error: err.message };
  }
};

const createOrder = async (req, res) => {
  try {
    const { table_id, user_id, items, total_price } = req.body;
    console.log("📝 Yangi zakaz ma'lumotlari:", req.body);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Kamida bitta taom kerak" });
    }

    const updatedItems = [];

    // 🔍 Har bir item uchun ma'lumotlarni to'ldirish
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
        return res.status(400).json({
          message: `Kategoriya/printer topilmadi: ${food.name}`,
        });
      }

      const printer = await Printer.findById(category.printer_id);
      if (!printer) {
        return res.status(404).json({
          message: `Printer topilmadi: ${category.printer_id}`,
        });
      }

      updatedItems.push({
        food_id,
        name: food.name,
        price: food.price,
        quantity,
        category_name: category.title,
        printer_id: category.printer_id,
        printer_ip: printer.ip,
        printer_name: printer.name,
      });
    }

    // 💾 Zakazni saqlash
    const newOrder = await Order.create({
      table_id,
      user_id,
      items: updatedItems,
      table_number: req.body.table_number,
      total_price,
      status: "pending",
      waiter_name: req.body.first_name,
    });

    console.log("✅ Zakaz saqlandi:", newOrder._id);

    // 🖨️ YAXSHILANGAN: Printer bo'yicha guruhlab yuborish
    const printerGroups = {};

    for (const item of updatedItems) {
      if (!item.printer_ip) {
        console.warn(`⚠️ Printer IP yo'q: ${item.name}`);
        continue;
      }

      const printerKey = item.printer_ip;

      if (!printerGroups[printerKey]) {
        printerGroups[printerKey] = {
          printer_ip: item.printer_ip,
          printer_name: item.printer_name,
          items: [],
        };
      }

      printerGroups[printerKey].items.push({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category_name,
        food_id: item.food_id,
      });
    }

    console.log("🖨️ Printer guruhlari:", Object.keys(printerGroups));

    // 🖨️ Har bir printer guruhiga sizning print server orqali yuborish
    const printResults = [];

    for (const [printerIp, group] of Object.entries(printerGroups)) {
      console.log(
        `📤 ${printerIp} ga yuborilmoqda:`,
        group.items.length,
        "ta item"
      );

      const payload = {
        items: group.items,
        table_number: req.body.table_number || table_id,
        waiter_name: req.body.first_name || "Nomalum",
        date: new Date().toLocaleString("uz-UZ"),
        type: "new_order",
        order_id: newOrder._id.toString(),
        printerIp: printerIp, // Print server uchun IP
      };

      const printResult = await printToPrinter(printerIp, payload);
      printResults.push({
        printer_ip: printerIp,
        printer_name: group.printer_name,
        items_count: group.items.length,
        success: printResult.success,
        error: printResult.error || null,
      });
    }

    // 📊 Print natijalarini log qilish
    console.log("📊 Print natijalari:");
    printResults.forEach((result) => {
      if (result.success) {
        console.log(
          `✅ ${result.printer_ip} (${result.printer_name}) - ${result.items_count} item`
        );
      } else {
        console.log(
          `❌ ${result.printer_ip} (${result.printer_name}) - XATOLIK: ${result.error}`
        );
      }
    });

    // 🔄 Print natijalarini response ga qo'shish
    res.status(201).json({
      message: "Zakaz muvaffaqiyatli yaratildi",
      order: newOrder,
      print_results: printResults,
      total_printers: Object.keys(printerGroups).length,
      debug: {
        total_items: updatedItems.length,
        printer_groups: Object.keys(printerGroups),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Zakaz yaratishda xatolik:", error);
    res.status(500).json({
      message: "Server xatosi",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ✅ Qolgan funksiyalar o'zgarmaydi
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
      return res.status(400).json({ message: "Noto'g'ri status" });
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
    res.json({ message: "Zakaz o'chirildi" });
  } catch (err) {
    res.status(500).json({ message: "Zakaz o'chirishda xatolik" });
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

// 🔄 ZAKASNI YOPISH (chek chiqarish o'chirildi - faqat frontend dan)
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("items.food_id");
    if (!order) return res.status(404).json({ message: "Zakaz topilmadi" });

    if (order.status === "closed")
      return res.status(400).json({ message: "Zakaz allaqachon yopilgan" });

    const waiter = await User.findById(order.user_id);
    const setting = await Setting.findOne();

    // ✅ Faqat status ni o'zgartirish
    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    // 📋 Chek ma'lumotlarini tayyorlash (frontend uchun)
    const checkData = {
      restaurant_name: setting?.restaurant_name || "RESTORAN",
      address: setting?.address || "",
      phone: setting?.phone || "",
      table_number: order.table_number || order.table_id,
      date: new Date().toLocaleString("uz-UZ"),
      waiter_name: waiter?.first_name || "Afitsant",
      items: order.items,
      total_price: order.total_price,
      order_id: order._id.toString(),
    };

    // ❌ AVTOMATIK CHEK CHIQARISH O'CHIRILDI
    // Frontend o'zi chek chiqaradi!

    console.log("✅ Zakaz yopildi:", order._id);

    res.status(200).json({
      message: "Zakaz yopildi",
      order,
      check: checkData, // Frontend uchun chek ma'lumotlari
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
