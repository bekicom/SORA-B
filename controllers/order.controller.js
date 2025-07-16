const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Printer = require("../models/Printer");
const Table = require("../models/Table");
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

// 🧾 Kassir chekini chiqarish (Enhanced Settings integration)
const printReceiptToKassir = async (receiptData) => {
  try {
    console.log("🧾 Kassir cheki chiqarilmoqda...");

    // ✅ SETTINGS dan kassir printer IP olish
    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );
    const kassirPrinterIp =
      settings?.kassir_printer_ip ||
      receiptData.kassir_printer_ip ||
      "192.168.0.106";

    console.log(`📡 Kassir printer IP: ${kassirPrinterIp}`);

    const response = await axios.post(
      `http://localhost:5000/print-check`,
      {
        ...receiptData,
        kassir_printer_ip: kassirPrinterIp,
      },
      {
        timeout: 10000, // ✅ Timeout oshirildi
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `✅ Kassir cheki muvaffaqiyatli chiqarildi (${kassirPrinterIp})`
    );
    return {
      success: true,
      response: response.data,
      printer_ip: kassirPrinterIp,
    };
  } catch (err) {
    console.error(`❌ Kassir cheki chiqarishda xatolik:`, err.message);
    return {
      success: false,
      error: err.message,
      printer_ip: receiptData.kassir_printer_ip,
    };
  }
};

// 🧾 ZAKASNI YOPISH VA AVTOMATIK CHEK CHIQARISH (ENHANCED)
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔒 Zakaz yopilmoqda:", orderId);

    // ✅ Order ni populate bilan topish (user va table bilan items)
    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id")
      .populate("items.food_id"); // ✅ Items ham populate qilingan

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi",
      });
    }

    if (order.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Zakaz allaqachon yopilgan",
      });
    }

    // ✅ Settings ni kassir printer bilan olish
    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );

    if (!settings) {
      console.warn("⚠️ Settings topilmadi, default qiymatlar ishlatiladi");
    }

    console.log("📋 Settings info:", {
      kassir_printer_configured: !!settings?.kassir_printer_id,
      auto_print_enabled: settings?.auto_print_receipt,
      print_copies: settings?.print_receipt_copies,
      kassir_printer_name: settings?.kassir_printer_id?.name,
      kassir_printer_ip: settings?.kassir_printer_ip,
    });

    // User va Table ma'lumotlari
    const waiter = order.user_id;
    const table = order.table_id;

    console.log("📋 Order ma'lumotlari:", {
      order_id: order._id,
      daily_number: order.daily_order_number,
      formatted_number: order.formatted_order_number,
      table_name: table?.name,
      table_number: table?.number,
      waiter_name: waiter?.first_name,
      items_count: order.items?.length,
    });

    // 💰 Summalarni hisoblash
    const subtotal = order.total_price;
    const servicePercent = settings?.service_percent || 10;
    const taxPercent = settings?.tax_percent || 12;

    const serviceAmount = Math.round((subtotal * servicePercent) / 100);
    const taxAmount = Math.round((subtotal * taxPercent) / 100);
    const totalAmount = subtotal + serviceAmount + taxAmount;

    console.log("💰 Financial calculations:", {
      subtotal,
      servicePercent,
      serviceAmount,
      taxPercent,
      taxAmount,
      totalAmount,
    });

    // ✅ Order ni yopish
    order.status = "closed";
    order.closedAt = new Date();
    order.service_amount = serviceAmount;
    order.tax_amount = taxAmount;
    order.final_total = totalAmount;
    await order.save();

    console.log("✅ Order yopildi va saqlandi");

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

    // 📋 Chek ma'lumotlarini tayyorlash (Enhanced)
    const receiptData = {
      // Restaurant info
      restaurant_name: settings?.restaurant_name || "SORA RESTAURANT",
      address: settings?.address || "",
      phone: settings?.phone || "",
      email: settings?.email || "",
      website: settings?.website || "",

      // ✅ Order info (daily number + table info)
      order_id: order._id.toString(),
      daily_order_number: order.daily_order_number,
      formatted_order_number:
        order.formatted_order_number ||
        `#${String(order.daily_order_number || 1).padStart(3, "0")}`,

      // ✅ Table info (number instead of ID)
      table_id: tableDisplayInfo.id,
      table_name: tableDisplayInfo.name,
      table_number: tableDisplayInfo.number,
      table_display: tableDisplayInfo.display_name,

      // Date info
      date: new Date().toLocaleString("uz-UZ"),
      closed_at: order.closedAt.toLocaleString("uz-UZ"),
      order_date: order.order_date || new Date().toISOString().split("T")[0],

      // ✅ Waiter info
      waiter_name: waiter?.first_name || order.waiter_name || "Afitsant",
      waiter_id: waiter?._id,

      // ✅ Items (enhanced with safety checks)
      items: (order.items || []).map((item) => ({
        name: item.name || "Unknown Item",
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: (item.quantity || 1) * (item.price || 0),
        category: item.category_name || "Unknown Category",
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
      kassir_printer_ip: settings?.kassir_printer_ip,

      // ✅ Additional metadata
      print_time: new Date().toISOString(),
      receipt_number: `RCP-${
        order.daily_order_number || order._id.toString().slice(-6)
      }`,
    };

    console.log("📋 Receipt data prepared:", {
      order_number: receiptData.formatted_order_number,
      table_display: receiptData.table_display,
      total_amount: receiptData.total_amount,
      items_count: receiptData.items.length,
      kassir_printer_ip: receiptData.kassir_printer_ip,
    });

    // 🧾 AVTOMATIK KASSIR CHEKINI CHIQARISH (Enhanced)
    let receiptResults = [];
    let totalPrintSuccess = 0;
    let printEnabled = false;

    // ✅ Print settings validation
    if (settings?.auto_print_receipt) {
      if (settings?.kassir_printer_ip && settings?.kassir_printer_id) {
        printEnabled = true;
        console.log(
          "🖨️ Avtomatik print yoqilgan va printer konfiguratsiya qilingan"
        );
      } else {
        console.warn(
          "⚠️ Auto print yoqilgan lekin kassir printer to'liq konfiguratsiya qilinmagan"
        );
      }
    } else {
      console.log("ℹ️ Avtomatik print o'chirilgan");
    }

    if (printEnabled) {
      console.log("🖨️ Kassir cheki chiqarilmoqda...");

      const printCopies = Math.max(
        1,
        Math.min(5, settings?.print_receipt_copies || 1)
      ); // ✅ Safety bounds

      for (let copy = 1; copy <= printCopies; copy++) {
        try {
          const copyReceiptData = {
            ...receiptData,
            copy_number: copy,
            total_copies: printCopies,
            print_time: new Date().toISOString(),
          };

          console.log(`🖨️ Printing copy ${copy}/${printCopies}...`);
          const receiptResult = await printReceiptToKassir(copyReceiptData);

          receiptResults.push({
            copy_number: copy,
            success: receiptResult.success,
            error: receiptResult.error || null,
            printer_ip: receiptResult.printer_ip || settings.kassir_printer_ip,
            printer_name: settings.kassir_printer_id?.name || "Kassir Printer",
            print_time: new Date().toISOString(),
          });

          if (receiptResult.success) {
            totalPrintSuccess++;
            console.log(
              `✅ Kassir cheki nusxasi ${copy}/${printCopies} muvaffaqiyatli chiqarildi`
            );
          } else {
            console.error(
              `❌ Kassir cheki nusxasi ${copy}/${printCopies} xatolik:`,
              receiptResult.error
            );
          }

          // ✅ Nusxalar orasida pauza (faqat ko'p nusxa bo'lsa)
          if (copy < printCopies && printCopies > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (receiptError) {
          console.error(
            `❌ Kassir cheki nusxasi ${copy} chiqarishda xatolik:`,
            receiptError
          );
          receiptResults.push({
            copy_number: copy,
            success: false,
            error: receiptError.message,
            printer_ip: settings?.kassir_printer_ip,
            printer_name: settings?.kassir_printer_id?.name || "Kassir Printer",
            print_time: new Date().toISOString(),
          });
        }
      }

      console.log(
        `📊 Print results: ${totalPrintSuccess}/${printCopies} successful`
      );
    } else {
      // ✅ Manual fallback (always attempt)
      console.log("🔄 Manual fallback print attempt...");
      try {
        const manualResult = await printReceiptToKassir(receiptData);
        receiptResults.push({
          copy_number: 1,
          success: manualResult.success,
          error: manualResult.error || null,
          printer_ip: manualResult.printer_ip || receiptData.kassir_printer_ip,
          printer_name: "Manual Print",
          note: "Auto print disabled - manual fallback",
          print_time: new Date().toISOString(),
        });

        if (manualResult.success) {
          totalPrintSuccess = 1;
          console.log("✅ Manual fallback print successful");
        } else {
          console.error("❌ Manual fallback print failed:", manualResult.error);
        }
      } catch (manualError) {
        console.error("❌ Manual fallback print error:", manualError);
        receiptResults.push({
          copy_number: 1,
          success: false,
          error: manualError.message,
          printer_ip: receiptData.kassir_printer_ip,
          printer_name: "Manual Print",
          note: "Manual fallback failed",
          print_time: new Date().toISOString(),
        });
      }
    }

    console.log("✅ Zakaz to'liq yopildi:", order.formatted_order_number);

    // ✅ Enhanced Response (frontend uchun to'liq ma'lumotlar)
    const response = {
      success: true,
      message:
        totalPrintSuccess > 0
          ? `Zakaz yopildi va ${totalPrintSuccess} ta chek chiqarildi`
          : "Zakaz yopildi (chek chiqarilmadi)",

      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number:
          order.formatted_order_number ||
          `#${String(order.daily_order_number || 1).padStart(3, "0")}`,
        status: order.status,
        closed_at: order.closedAt,
        service_amount: serviceAmount,
        tax_amount: taxAmount,
        final_total: totalAmount,
        order_date: order.order_date,
      },

      table: tableDisplayInfo,

      receipt: {
        printed: totalPrintSuccess > 0,
        total_copies: receiptResults.length,
        successful_copies: totalPrintSuccess,
        failed_copies: receiptResults.length - totalPrintSuccess,
        auto_print_enabled: settings?.auto_print_receipt || false,

        kassir_printer: settings?.kassir_printer_id
          ? {
              id: settings.kassir_printer_id._id,
              name: settings.kassir_printer_id.name,
              ip: settings.kassir_printer_id.ip || settings.kassir_printer_ip,
              status: settings.kassir_printer_id.status || "unknown",
            }
          : null,

        print_results: receiptResults,
        data: receiptData,
      },

      totals: {
        subtotal,
        service: `${servicePercent}% = ${serviceAmount}`,
        tax: `${taxPercent}% = ${taxAmount}`,
        total: totalAmount,
        currency: settings?.currency || "UZS",
      },

      // ✅ Debug info
      debug: {
        settings_found: !!settings,
        auto_print_configured: printEnabled,
        print_attempts: receiptResults.length,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Zakaz yopishda kritik xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Zakaz yopishda xatolik",
      error: err.message,
      debug: {
        orderId: req.params.orderId,
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
    });
  }
};

// 🧾 ALOHIDA CHEK CHIQARISH ENDPOINT (Enhanced)
const printReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🧾 Manual chek chiqarish:", orderId);

    // ✅ Order ni populate bilan topish
    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi",
      });
    }

    // ✅ Settings va printer info
    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );
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

    // ✅ Enhanced receipt data
    const receiptData = {
      restaurant_name: settings?.restaurant_name || "SORA RESTAURANT",
      address: settings?.address || "",
      phone: settings?.phone || "",
      email: settings?.email || "",

      // ✅ Order info with daily number
      order_id: order._id.toString(),
      daily_order_number: order.daily_order_number,
      formatted_order_number:
        order.formatted_order_number ||
        `#${String(order.daily_order_number || 1).padStart(3, "0")}`,

      // ✅ Table info
      table_number: tableDisplayInfo.number,
      table_display: tableDisplayInfo.display_name,

      date: order.closedAt
        ? order.closedAt.toLocaleString("uz-UZ")
        : new Date().toLocaleString("uz-UZ"),
      waiter_name: waiter?.first_name || order.waiter_name || "Afitsant",

      items: (order.items || []).map((item) => ({
        name: item.name || "Unknown Item",
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: (item.quantity || 1) * (item.price || 0),
      })),

      subtotal: order.total_price,
      service_amount: serviceAmount,
      tax_amount: taxAmount,
      total_amount: subtotal,

      currency: settings?.currency || "UZS",
      footer_text: settings?.footer_text || "Rahmat!",
      type: "receipt_reprint",

      // ✅ Reprint metadata
      reprint_time: new Date().toISOString(),
      kassir_printer_ip: settings?.kassir_printer_ip,
    };

    console.log("🖨️ Manual print attempt:", {
      order_number: receiptData.formatted_order_number,
      kassir_printer: settings?.kassir_printer_id?.name,
      printer_ip: settings?.kassir_printer_ip,
    });

    // Chekni chiqarish
    const receiptResult = await printReceiptToKassir(receiptData);

    const response = {
      success: receiptResult.success,
      message: receiptResult.success
        ? "Chek muvaffaqiyatli chiqarildi"
        : "Chek chiqarishda xatolik",
      error: receiptResult.error || null,
      printer: {
        ip: receiptResult.printer_ip,
        name: settings?.kassir_printer_id?.name || "Default Printer",
      },
      receipt_data: receiptData,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Manual chek chiqarishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Chek chiqarishda xatolik",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};

// ✅ Qolgan funksiyalar o'zgarishsiz...
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
      table_number: tableNumber,
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
        table_number: tableNumber,
        waiter_name: req.body.first_name || "Nomalum",
        date: new Date().toLocaleString("uz-UZ"),
        type: "new_order",
        order_id: newOrder._id.toString(),
        order_number: newOrder.formatted_order_number,
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
        order_number: newOrder.formatted_order_number,
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
