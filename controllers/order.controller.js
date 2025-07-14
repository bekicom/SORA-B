const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Printer = require("../models/Printer");
const Table = require("../models/Table"); // 🆕 Table model import
const axios = require("axios");

// 🖨️ Print server orqali yuborish
const printToPrinter = async (printerIp, data) => {
  try {
    console.log(
      `🖨️ Print yuborilmoqda (${printerIp}):`,
      JSON.stringify(data, null, 2)
    );

    const response = await axios.post(
      `http://localhost:5000/print`,
      {
        ...data,
        printerIp: printerIp,
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

// 🧾 Kassir chekini chiqarish (Settings bilan)
const printReceiptToKassir = async (receiptData) => {
  try {
    console.log("🧾 Kassir cheki chiqarilmoqda...");

    const kassirPrinterIp = receiptData.kassir_printer_ip || "192.168.0.100";

    const response = await axios.post(
      `http://localhost:5000/print-check`,
      receiptData,
      {
        timeout: 8000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `✅ Kassir cheki muvaffaqiyatli chiqarildi (${kassirPrinterIp})`
    );
    return { success: true, response: response.data };
  } catch (err) {
    console.error(`❌ Kassir cheki chiqarishda xatolik:`, err.message);
    return { success: false, error: err.message };
  }
};

// 🧾 ZAKASNI YOPISH VA CHEK CHIQARISH (YANGILANDI - Daily Number + Table Info)
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔒 Zakaz yopilmoqda:", orderId);

    // ✅ Order ni populate bilan topish (user va table)
    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id");

    if (!order) {
      return res.status(404).json({ message: "Zakaz topilmadi" });
    }

    if (order.status === "closed") {
      return res.status(400).json({ message: "Zakaz allaqachon yopilgan" });
    }

    // Settings ni olish
    const settings = await Settings.findOne({ is_active: true });

    // User va Table ma'lumotlari
    const waiter = order.user_id;
    const table = order.table_id;

    console.log("📋 Ma'lumotlar:", {
      order_daily_number: order.daily_order_number,
      order_formatted: order.formatted_order_number,
      table_name: table?.name,
      table_number: table?.number,
      waiter_name: waiter?.first_name,
    });

    // 💰 Summalarni hisoblash
    const subtotal = order.total_price;
    const servicePercent = settings?.service_percent || 10;
    const taxPercent = settings?.tax_percent || 12;

    const serviceAmount = Math.round((subtotal * servicePercent) / 100);
    const taxAmount = Math.round((subtotal * taxPercent) / 100);
    const totalAmount = subtotal + serviceAmount + taxAmount;

    // ✅ Order ni yopish
    order.status = "closed";
    order.closedAt = new Date();
    order.service_amount = serviceAmount;
    order.tax_amount = taxAmount;
    order.final_total = totalAmount;
    await order.save();

    // 🆕 Table display info
    const tableDisplayInfo = table
      ? {
          id: table._id,
          name: table.name,
          number: table.number || table.name,
          display_name: table.display_name || table.name,
        }
      : {
          id: order.table_id,
          name: order.table_number || "Noma'lum",
          number: order.table_number || "Noma'lum",
          display_name: order.table_number || "Noma'lum",
        };

    // 📋 Chek ma'lumotlarini tayyorlash
    const receiptData = {
      // Restaurant info
      restaurant_name: settings?.restaurant_name || "RESTORAN",
      address: settings?.address || "",
      phone: settings?.phone || "",
      email: settings?.email || "",
      website: settings?.website || "",

      // ✅ Order info (daily number + table info)
      order_id: order._id.toString(),
      daily_order_number: order.daily_order_number,
      formatted_order_number: order.formatted_order_number,

      // ✅ Table info (number instead of ID)
      table_id: tableDisplayInfo.id,
      table_name: tableDisplayInfo.name,
      table_number: tableDisplayInfo.number,
      table_display: tableDisplayInfo.display_name,

      // Date info
      date: new Date().toLocaleString("uz-UZ"),
      closed_at: order.closedAt.toLocaleString("uz-UZ"),
      order_date: order.order_date,

      // ✅ Waiter info
      waiter_name: waiter?.first_name || order.waiter_name || "Afitsant",
      waiter_id: waiter?._id,

      // Items
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      })),

      // Calculations
      subtotal: subtotal,
      service_percent: servicePercent,
      service_amount: serviceAmount,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total_amount: totalAmount,

      // Settings
      currency: settings?.currency || "UZS",
      footer_text: settings?.footer_text || "Rahmat! Yana tashrif buyuring!",
      show_qr: settings?.show_qr || false,

      // Print settings
      type: "receipt",
      kassir_printer_ip: settings?.kassir_printer_ip || "192.168.0.100",
    };

    console.log("📋 Chek ma'lumotlari tayyorlandi:", {
      daily_number: receiptData.daily_order_number,
      formatted_number: receiptData.formatted_order_number,
      table_display: receiptData.table_display,
      total_amount: receiptData.total_amount,
      items_count: receiptData.items.length,
    });

    // 🧾 Kassir chekini chiqarish
    let receiptResult = { success: false, error: "Chek chiqarilmadi" };

    try {
      receiptResult = await printReceiptToKassir(receiptData);
      console.log("🧾 Kassir cheki natijasi:", receiptResult);
    } catch (receiptError) {
      console.error("❌ Kassir cheki xatoligi:", receiptError);
      receiptResult = { success: false, error: receiptError.message };
    }

    console.log("✅ Zakaz yopildi:", order.formatted_order_number);

    // ✅ Response yuborish (frontend uchun to'liq ma'lumotlar)
    res.status(200).json({
      success: true,
      message: "Zakaz muvaffaqiyatli yopildi",
      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number: order.formatted_order_number,
        status: order.status,
        closed_at: order.closedAt,
        service_amount: serviceAmount,
        tax_amount: taxAmount,
        final_total: totalAmount,
        order_date: order.order_date,
      },
      table: tableDisplayInfo,
      receipt: {
        printed: receiptResult.success,
        error: receiptResult.error || null,
        data: receiptData,
      },
      totals: {
        subtotal,
        service: `${servicePercent}% = ${serviceAmount}`,
        tax: `${taxPercent}% = ${taxAmount}`,
        total: totalAmount,
        currency: settings?.currency || "UZS",
      },
    });
  } catch (err) {
    console.error("❌ Zakaz yopishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Zakaz yopishda xatolik",
      error: err.message,
    });
  }
};

// 🧾 ALOHIDA CHEK CHIQARISH ENDPOINT (yangilandi)
const printReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🧾 Alohida chek chiqarish:", orderId);

    // ✅ Order ni populate bilan topish
    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id");

    if (!order) {
      return res.status(404).json({ message: "Zakaz topilmadi" });
    }

    const settings = await Settings.findOne({ is_active: true });
    const waiter = order.user_id;
    const table = order.table_id;

    // Summalarni hisoblash
    const subtotal = order.final_total || order.total_price;
    const serviceAmount = order.service_amount || 0;
    const taxAmount = order.tax_amount || 0;

    // Table info
    const tableDisplayInfo = table
      ? {
          number: table.number || table.name,
          display_name: table.display_name || table.name,
        }
      : {
          number: order.table_number || "Noma'lum",
          display_name: order.table_number || "Noma'lum",
        };

    // Chek ma'lumotlari
    const receiptData = {
      restaurant_name: settings?.restaurant_name || "RESTORAN",
      address: settings?.address || "",
      phone: settings?.phone || "",
      email: settings?.email || "",

      // ✅ Order info with daily number
      order_id: order._id.toString(),
      daily_order_number: order.daily_order_number,
      formatted_order_number: order.formatted_order_number,

      // ✅ Table info
      table_number: tableDisplayInfo.number,
      table_display: tableDisplayInfo.display_name,

      date: order.closedAt
        ? order.closedAt.toLocaleString("uz-UZ")
        : new Date().toLocaleString("uz-UZ"),
      waiter_name: waiter?.first_name || order.waiter_name || "Afitsant",

      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      })),

      subtotal: order.total_price,
      service_amount: serviceAmount,
      tax_amount: taxAmount,
      total_amount: subtotal,

      currency: settings?.currency || "UZS",
      footer_text: settings?.footer_text || "Rahmat!",
      type: "receipt_reprint",
    };

    // Chekni chiqarish
    const receiptResult = await printReceiptToKassir(receiptData);

    res.status(200).json({
      success: receiptResult.success,
      message: receiptResult.success
        ? "Chek muvaffaqiyatli chiqarildi"
        : "Chek chiqarishda xatolik",
      error: receiptResult.error || null,
      receipt_data: receiptData,
    });
  } catch (err) {
    console.error("❌ Chek chiqarishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Chek chiqarishda xatolik",
      error: err.message,
    });
  }
};

// Qolgan funksiyalar o'zgarishsiz...
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

    // ✅ Table ma'lumotlarini olish
    const table = await Table.findById(table_id);
    const tableNumber = table?.number || table?.name || req.body.table_number;

    // 💾 Zakazni saqlash (daily_order_number avtomatik generate bo'ladi)
    const newOrder = await Order.create({
      table_id,
      user_id,
      items: updatedItems,
      table_number: tableNumber, // ✅ To'g'ri table number
      total_price,
      status: "pending",
      waiter_name: req.body.first_name,
    });

    console.log("✅ Zakaz saqlandi:", newOrder.formatted_order_number);

    // Print logic o'zgarishsiz...
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

    const printResults = [];

    for (const [printerIp, group] of Object.entries(printerGroups)) {
      const payload = {
        items: group.items,
        table_number: tableNumber, // ✅ To'g'ri table number
        waiter_name: req.body.first_name || "Nomalum",
        date: new Date().toLocaleString("uz-UZ"),
        type: "new_order",
        order_id: newOrder._id.toString(),
        order_number: newOrder.formatted_order_number, // ✅ Formatted number
        printerIp: printerIp,
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

    res.status(201).json({
      message: "Zakaz muvaffaqiyatli yaratildi",
      order: newOrder,
      print_results: printResults,
      total_printers: Object.keys(printerGroups).length,
      debug: {
        total_items: updatedItems.length,
        printer_groups: Object.keys(printerGroups),
        order_number: newOrder.formatted_order_number, // ✅ Daily number
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

// Qolgan funksiyalar...
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

    // ✅ Populate bilan table ma'lumotlarini olish
    const pendingOrders = await Order.find({
      user_id: userId,
      status: "pending",
    })
      .populate("table_id")
      .sort({ createdAt: -1 });

    res.status(200).json(pendingOrders);
  } catch (error) {
    console.error("Pending orders error:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
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
  printReceipt,
};
