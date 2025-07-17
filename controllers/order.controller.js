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
        timeout: 10000,
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

// ✅ ZAKASNI YOPISH - KASSIR WORKFLOW (CHEK CHIQARMASLIK)
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id; // Qaysi ofitsiant yopyapti
    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id")
      .populate("items.food_id");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi",
      });
    }

    // ✅ Status tekshirish (completed/paid/cancelled emas)
    if (["completed", "paid", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Zakaz allaqachon ${order.status} holatida`,
      });
    }

    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );

    const waiter = order.user_id;
    const table = order.table_id;

    console.log("📋 Order ma'lumotlari:", {
      order_id: order._id,
      daily_number: order.daily_order_number,
      formatted_number: order.formatted_order_number,
      current_status: order.status,
      table_name: table?.name,
      waiter_name: waiter?.first_name,
      items_count: order.items?.length,
    });

    // 💰 Financial calculations
    const subtotal = order.total_price;
    const servicePercent = settings?.service_percent || 10;
    const taxPercent = settings?.tax_percent || 12;

    const serviceAmount = Math.round((subtotal * servicePercent) / 100);
    const taxAmount = 0;
    const totalAmount = subtotal + serviceAmount + taxAmount;

    console.log("💰 Financial calculations:", {
      subtotal,
      servicePercent,
      serviceAmount,
      taxPercent,
      taxAmount,
      totalAmount,
    });
    order.status = "completed"; // "closed" emas!
    order.completedAt = new Date();
    order.completedBy = userId;
    order.closedAt = order.completedAt; // Backward compatibility
    order.service_amount = serviceAmount;
    order.tax_amount = taxAmount;
    order.final_total = totalAmount;
    await order.save();
    // Table display info
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
    // ✅ Response (CHEK CHIQARILMAGAN)
    const response = {
      success: true,
      message: "Zakaz yopildi va kassir bo'limiga yuborildi",

      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number: order.formatted_order_number,
        status: order.status, // "completed"
        completed_at: order.completedAt,
        completed_by: waiter?.first_name,
        service_amount: serviceAmount,
        tax_amount: taxAmount,
        final_total: totalAmount,
        order_date: order.order_date,
      },
      table: tableDisplayInfo,
      kassir_workflow: {
        enabled: true,
        status: "pending_payment",
        next_step: "Kassir to'lov qabul qilishi kerak",
        receipt_printed: false,
        auto_print_disabled: true, // ✅ Avtomatik print o'chirilgan
      },
      totals: {
        subtotal,
        service: `${servicePercent}% = ${serviceAmount}`,
        tax: `${taxPercent}% = ${taxAmount}`,
        total: totalAmount,
        currency: settings?.currency || "UZS",
      },

      debug: {
        workflow: "kassir_enabled",
        auto_print: false,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Zakaz yopishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Zakaz yopishda xatolik",
      error: err.message,
      debug: {
        orderId: req.params.orderId,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// ✅ KASSIR UCHUN CHEK CHIQARISH (Manual)
const printReceiptForKassir = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id; // Qaysi kassir chek chiqaryapti

    console.log("🧾 Kassir chek chiqarish:", orderId);

    const order = await Order.findById(orderId)
      .populate("user_id")
      .populate("table_id")
      .populate("completedBy", "first_name last_name");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi",
      });
    }

    // ✅ Faqat completed/paid status'dagi zakaz'lar uchun
    if (!["completed", "paid"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Faqat yopilgan zakaz'lar uchun chek chiqarish mumkin",
        current_status: order.status,
      });
    }

    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );
    const waiter = order.user_id;
    const table = order.table_id;

    const tableDisplayInfo = table
      ? {
          number: table.number || table.name,
          display_name: table.display_name || table.name,
        }
      : {
          number: order.table_number || "Noma'lum",
          display_name: order.table_number || "Noma'lum",
        };

    // ✅ Receipt data preparation
    const receiptData = {
      restaurant_name: settings?.restaurant_name || "SORA RESTAURANT",
      address: settings?.address || "",
      phone: settings?.phone || "",
      email: settings?.email || "",
      website: settings?.website || "",

      order_id: order._id.toString(),
      daily_order_number: order.daily_order_number,
      formatted_order_number: order.formatted_order_number,

      table_number: tableDisplayInfo.number,
      table_display: tableDisplayInfo.display_name,

      date: order.completedAt
        ? order.completedAt.toLocaleString("uz-UZ")
        : new Date().toLocaleString("uz-UZ"),
      waiter_name: waiter?.first_name || order.waiter_name || "Afitsant",

      items: (order.items || []).map((item) => ({
        name: item.name || "Unknown Item",
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: (item.quantity || 1) * (item.price || 0),
      })),

      subtotal: order.total_price,
      service_amount: order.service_amount || 0,
      tax_amount: order.tax_amount || 0,
      total_amount: order.final_total || order.total_price,

      currency: settings?.currency || "UZS",
      footer_text: settings?.footer_text || "Rahmat!",
      show_qr: settings?.show_qr || false,
      type: "kassir_receipt",

      // ✅ Kassir metadata
      printed_by_kassir: true,
      print_time: new Date().toISOString(),
      kassir_printer_ip: settings?.kassir_printer_ip,
    };

    console.log("🖨️ Kassir chek chiqarish:", {
      order_number: receiptData.formatted_order_number,
      printer_ip: settings?.kassir_printer_ip,
      kassir_user: userId,
    });

    // Chekni chiqarish
    const receiptResult = await printReceiptToKassir(receiptData);

    // ✅ Receipt print holati yangilash
    if (receiptResult.success) {
      await order.markReceiptPrinted(userId);
      console.log("✅ Receipt printed status yangilandi");
    }

    const response = {
      success: receiptResult.success,
      message: receiptResult.success
        ? "Kassir cheki muvaffaqiyatli chiqarildi"
        : "Kassir cheki chiqarishda xatolik",
      error: receiptResult.error || null,

      order: {
        id: order._id,
        number: order.formatted_order_number,
        status: order.status,
        total: order.final_total,
        receipt_printed: receiptResult.success,
      },

      printer: {
        ip: receiptResult.printer_ip,
        name: settings?.kassir_printer_id?.name || "Kassir Printer",
      },

      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Kassir chek chiqarishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Kassir chek chiqarishda xatolik",
      error: err.message,
    });
  }
};

// ✅ KASSIR WORKFLOW - To'lov qabul qilish
const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, notes } = req.body;
    const userId = req.user?.id; // Qaysi kassir to'lov qabul qilyapti

    console.log("💰 To'lov qabul qilish:", { orderId, paymentMethod, userId });

    // ✅ Order'ni topish
    const order = await Order.findById(orderId)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("completedBy", "first_name last_name");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi",
      });
    }

    // ✅ Faqat completed holatidagi zakaz'lar uchun
    if (order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Faqat yopilgan zakaz'lar uchun to'lov qabul qilish mumkin",
        current_status: order.status,
      });
    }

    // ✅ Payment method validation
    const validPaymentMethods = ["cash", "card", "transfer", "mixed"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri to'lov usuli",
        valid_methods: validPaymentMethods,
      });
    }

    // ✅ To'lovni qayd qilish - Model method ishlatish
    await order.processPayment(userId, paymentMethod, notes);

    console.log("✅ To'lov muvaffaqiyatli qayd qilindi:", {
      order_number: order.formatted_order_number,
      payment_method: paymentMethod,
      total: order.final_total,
      kassir: userId,
    });

    // ✅ Response
    const response = {
      success: true,
      message: "To'lov muvaffaqiyatli qabul qilindi",

      order: {
        id: order._id,
        number: order.formatted_order_number,
        status: order.status, // "paid"
        total: order.final_total,
        payment_method: order.paymentMethod,
        paid_at: order.paidAt,
        receipt_printed: order.receiptPrinted,
      },

      payment: {
        method: paymentMethod,
        amount: order.final_total,
        currency: "UZS",
        notes: notes || null,
        processed_at: order.paidAt,
        processed_by: userId,
      },

      waiter: {
        name: order.user_id?.first_name,
        completed_by: order.completedBy?.first_name,
      },

      table: {
        number: order.table_id?.number || order.table_number,
        name: order.table_id?.name,
      },

      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ To'lov qabul qilishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "To'lov qabul qilishda xatolik",
      error: err.message,
      debug: {
        orderId: req.params.orderId,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

const getCompletedOrders = async (req, res) => {
  try {
    const { date, paid, current_user_only } = req.query;
    const userId = req.user?.id; // Current user ID

    console.log("📋 Completed orders request:", {
      date,
      paid,
      current_user_only,
      userId,
    });

    const options = {
      startDate: date || new Date().toISOString().split("T")[0],
      endDate: date || new Date().toISOString().split("T")[0],
      paid: paid !== undefined ? paid === "true" : undefined,
      current_user_only: current_user_only === "true",
      userId: userId,
    };

    // ✅ Query object yaratish
    let query = {
      order_date: { $gte: options.startDate, $lte: options.endDate },
    };

    // ✅ Agar current_user_only true bo'lsa, faqat shu user'ning zakaz'lari
    if (options.current_user_only && userId) {
      query.user_id = userId;
      console.log("🔒 Faqat current user'ning zakaz'lari:", userId);
    }

    // ✅ Status filter
    if (options.paid !== undefined) {
      query.status = options.paid ? "paid" : "completed";
    } else {
      query.status = { $in: ["completed", "paid"] };
    }

    console.log("🔍 Final query:", query);

    const orders = await Order.find(query)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("completedBy", "first_name last_name")
      .populate("paidBy", "first_name last_name")
      .sort({ completedAt: -1 })
      .limit(100);

    console.log("🔍 Raw orders from database:", {
      count: orders.length,
      paid_param: paid,
      current_user_only: options.current_user_only,
      user_id: userId,
      first_order: orders[0]
        ? {
            id: orders[0]._id,
            status: orders[0].status,
            user_id: orders[0].user_id,
            waiter_name: orders[0].waiter_name,
            formatted_number: orders[0].formatted_order_number,
            table_number: orders[0].table_number,
            total_price: orders[0].total_price,
            final_total: orders[0].final_total,
            items_length: orders[0].items?.length,
          }
        : null,
    });

    const response = {
      success: true,
      orders: orders.map((order) => ({
        id: order._id, // ✅ MongoDB ID
        orderNumber: order.formatted_order_number, // ✅ #041 format
        tableNumber: order.table_number, // ✅ Stol raqami
        waiterName: order.waiter_name, // ✅ Ofitsiant ismi
        itemsCount: order.items?.length || 0, // ✅ Mahsulotlar soni
        subtotal: order.total_price, // ✅ Subtotal
        serviceAmount: order.service_amount || 0, // ✅ Xizmat haqi
        taxAmount: order.tax_amount || 0, // ✅ Soliq
        finalTotal: order.final_total || order.total_price, // ✅ Jami summa
        completedAt: order.completedAt, // ✅ Yopilgan vaqt
        paidAt: order.paidAt, // ✅ To'langan vaqt
        status: order.status, // ✅ Status (completed/paid)
        receiptPrinted: order.receiptPrinted || false, // ✅ Chek holati
        paymentMethod: order.paymentMethod, // ✅ To'lov usuli
        paidBy: order.paidBy?.first_name || "Kassir", // ✅ Kim to'lov qabul qilgan
        completedBy: order.completedBy?.first_name || order.waiter_name, // ✅ Kim yopgan
      })),
      total_count: orders.length,
      filter: {
        date: options.startDate,
        status:
          options.paid === true
            ? "paid"
            : options.paid === false
            ? "completed"
            : "all",
        current_user_only: options.current_user_only,
        user_id: options.current_user_only ? userId : "all",
      },
      user_info: options.current_user_only
        ? {
            id: userId,
            name: orders[0]?.waiter_name || "Afitsant",
            today_orders: orders.length,
            today_revenue: orders.reduce(
              (sum, order) =>
                sum + (order.final_total || order.total_price || 0),
              0
            ),
          }
        : null,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ Processed response:", {
      orders_count: response.orders.length,
      filter_status: response.filter.status,
      current_user_only: response.filter.current_user_only,
      user_orders: response.user_info?.today_orders || "all_users",
      user_revenue: response.user_info?.today_revenue || "all_users",
      completed_count: response.orders.filter((o) => o.status === "completed")
        .length,
      paid_count: response.orders.filter((o) => o.status === "paid").length,
      first_processed_order: response.orders[0]
        ? {
            id: response.orders[0].id,
            orderNumber: response.orders[0].orderNumber,
            tableNumber: response.orders[0].tableNumber,
            waiterName: response.orders[0].waiterName,
            status: response.orders[0].status,
            finalTotal: response.orders[0].finalTotal,
          }
        : null,
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Completed orders olishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Completed orders olishda xatolik",
      error: err.message,
    });
  }
};

const getPendingPayments = async (req, res) => {
  try {
    console.log("📊 Kassir dashboard - pending payments");

    const orders = await Order.getPendingPayments();

    const response = {
      success: true,
      pending_orders: orders.map((order) => ({
        id: order._id,
        _id: order._id,
        orderNumber: order.formatted_order_number,
        tableNumber: order.table_number,
        waiterName: order.waiter_name,
        itemsCount: order.items?.length || 0,
        subtotal: order.total_price,
        serviceAmount: order.service_amount || 0,
        taxAmount: order.tax_amount || 0,
        finalTotal: order.final_total || order.total_price,
        completedAt: order.completedAt,
        status: order.status,
        receiptPrinted: order.receiptPrinted || false,
        paymentMethod: order.paymentMethod,
        kassirNotes: order.kassirNotes,
      })),
      total_pending: orders.length,
      total_amount: orders.reduce(
        (sum, order) => sum + (order.final_total || order.total_price || 0),
        0
      ),
      currency: "UZS",
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Pending payments olishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Pending payments olishda xatolik",
      error: err.message,
    });
  }
};

// ✅ DAILY SALES SUMMARY
const getDailySalesSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    console.log("📈 Daily sales summary:", targetDate);

    const summary = await Order.getDailySalesSummary(targetDate);

    res.status(200).json({
      success: true,
      date: targetDate,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Daily sales summary xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Daily sales summary xatolik",
      error: err.message,
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

    const table = await Table.findById(table_id);
    const tableNumber = table?.number || table?.name || req.body.table_number;

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

    // ✅ Updated allowed statuses
    const allowedStatuses = [
      "pending",
      "preparing",
      "ready",
      "served",
      "completed",
    ];
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

// ✅ Legacy printReceipt (backward compatibility)
const printReceipt = async (req, res) => {
  // Redirect to new kassir print function
  return await printReceiptForKassir(req, res);
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
  printReceiptForKassir,
  processPayment,
  getCompletedOrders,
  getPendingPayments,
  getDailySalesSummary,
};
