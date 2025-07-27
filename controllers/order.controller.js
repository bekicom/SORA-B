const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Printer = require("../models/Printer");
const Table = require("../models/Table"); // ✅ Table model import qo'shildi
const axios = require("axios");

// ✅ STOL STATUSINI YANGILASH FUNKSIYASI
const updateTableStatus = async (tableId, status) => {
  try {
    console.log(`🔄 Stol statusini yangilash: ${tableId} -> ${status}`);

    const table = await Table.findByIdAndUpdate(
      tableId,
      { status: status },
      { new: true }
    );

    if (table) {
      console.log(`✅ Stol statusi yangilandi: ${table.name} -> ${status}`);
      return { success: true, table };
    } else {
      console.warn(`⚠️ Stol topilmadi: ${tableId}`);
      return { success: false, error: "Stol topilmadi" };
    }
  } catch (error) {
    console.error(`❌ Stol statusini yangilashda xatolik:`, error);
    return { success: false, error: error.message };
  }
};

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

// 🧾 Kassir chekini chiqarish
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

// ✅ ZAKASNI YOPISH - STOL STATUSINI BO'SH QILISH BILAN
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
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
      table_id: table?._id,
      waiter_name: waiter?.first_name,
      waiter_percent: waiter?.percent || 0,
      items_count: order.items?.length,
    });

    // 💰 Financial calculations
    const subtotal = order.total_price;
    const servicePercent = settings?.service_percent || 10;
    const taxPercent = settings?.tax_percent || 12;
    const waiterPercent = waiter?.percent || 0;
    const waiterAmount = Math.round((subtotal * waiterPercent) / 100);
    const serviceAmount = Math.round((subtotal * servicePercent) / 100);
    const taxAmount = 0;
    const totalAmount = subtotal + serviceAmount + taxAmount + waiterAmount;

    // ✅ Orderga ma'lumotlarni saqlash
    order.status = "completed";
    order.completedAt = new Date();
    order.completedBy = userId;
    order.closedAt = order.completedAt;
    order.service_amount = serviceAmount;
    order.tax_amount = taxAmount;
    order.waiter_percent = waiterPercent;
    order.waiter_amount = waiterAmount;
    order.final_total = totalAmount;
    await order.save();

    // ✅ STOL STATUSINI BO'SH QILISH
    if (order.table_id) {
      const tableUpdateResult = await updateTableStatus(
        order.table_id,
        "bo'sh"
      );
      console.log("📋 Stol statusi yangilash natijasi:", tableUpdateResult);
    }

    const tableDisplayInfo = table
      ? {
          id: table._id,
          name: table.name,
          number: table.number || table.name,
          display_name: table.display_name || table.name,
          status: "bo'sh", // ✅ Yangi status
        }
      : {
          id: order.table_id,
          name: order.table_number || "Noma'lum",
          number: order.table_number || "Noma'lum",
          display_name: order.table_number || "Noma'lum",
          status: "bo'sh",
        };

    const response = {
      success: true,
      message: "Zakaz yopildi, kassir bo'limiga yuborildi va stol bo'shatildi",

      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number: order.formatted_order_number,
        status: order.status,
        completed_at: order.completedAt,
        completed_by: waiter?.first_name,
        service_amount: serviceAmount,
        tax_amount: taxAmount,
        waiter_amount: waiterAmount,
        final_total: totalAmount,
        order_date: order.order_date,
      },

      table: tableDisplayInfo,

      waiter: {
        id: waiter?._id,
        name: waiter?.first_name,
        percent: waiterPercent,
        earned_amount: waiterAmount,
        note:
          waiterPercent > 0
            ? `Afitsant ${waiterPercent}% oladi`
            : "Afitsant foizi belgilanmagan",
      },

      kassir_workflow: {
        enabled: true,
        status: "pending_payment",
        next_step: "Kassir to'lov qabul qilishi kerak",
        receipt_printed: false,
        auto_print_disabled: true,
      },

      // ✅ STOL STATUSI MA'LUMOTI
      table_status: {
        updated: true,
        previous_status: "band",
        current_status: "bo'sh",
        message: "Stol avtomatik ravishda bo'shatildi",
      },

      totals: {
        subtotal,
        service: `${servicePercent}% = ${serviceAmount}`,
        tax: `${taxPercent}% = ${taxAmount}`,
        waiter: `${waiterPercent}% = ${waiterAmount}`,
        total: totalAmount,
        currency: settings?.currency || "UZS",
        breakdown: {
          food_cost: subtotal,
          service_fee: serviceAmount,
          tax_fee: taxAmount,
          waiter_fee: waiterAmount,
          grand_total: totalAmount,
        },
      },

      debug: {
        workflow: "kassir_enabled_with_waiter_percent",
        auto_print: false,
        table_status_updated: true,
        waiter_calculation: {
          base_amount: subtotal,
          waiter_percent: waiterPercent,
          waiter_bonus: waiterAmount,
          total_with_waiter: totalAmount,
        },
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

// ✅ YANGI ZAKAZ YARATISH - STOL STATUSINI BAND QILISH BILAN
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

    // ✅ ZAKAZ YARATISH
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

    // ✅ STOL STATUSINI BAND QILISH
    if (table_id) {
      const tableUpdateResult = await updateTableStatus(table_id, "band");
      console.log("📋 Stol band qilish natijasi:", tableUpdateResult);
    }

    // Print logic
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
      message: "Zakaz muvaffaqiyatli yaratildi va stol band qilindi",
      order: newOrder,
      print_results: printResults,
      total_printers: Object.keys(printerGroups).length,
      // ✅ STOL STATUSI MA'LUMOTI
      table_status: {
        updated: true,
        previous_status: table?.status || "bo'sh",
        current_status: "band",
        table_name: tableNumber,
        message: "Stol avtomatik ravishda band qilindi",
      },
      debug: {
        total_items: updatedItems.length,
        printer_groups: Object.keys(printerGroups),
        order_number: newOrder.formatted_order_number,
        table_status_updated: true,
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

// ✅ TO'LOV QABUL QILISH - STOL STATUSINI BO'SH QILISH BILAN
const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, paymentAmount, changeAmount, mixedPayment, notes } =
      req.body;
    const userId = req.user?.id;

    console.log("💰 To'lov qabul qilish:", {
      orderId,
      paymentMethod,
      paymentAmount,
      changeAmount,
      mixedPayment,
      notes,
      userId,
    });

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

    if (!["completed", "pending_payment"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Faqat yopilgan yoki qayta ochildi zakaz'lar uchun to'lov qabul qilish mumkin",
        current_status: order.status,
      });
    }

    const validPaymentMethods = ["cash", "card", "transfer", "mixed"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri to'lov usuli",
        valid_methods: validPaymentMethods,
      });
    }

    // Payment validation logic...
    if (paymentMethod === "mixed") {
      if (
        !mixedPayment ||
        !mixedPayment.cashAmount ||
        !mixedPayment.cardAmount ||
        !mixedPayment.totalAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Mixed payment uchun cashAmount, cardAmount va totalAmount kerak",
          debug: { mixedPayment },
        });
      }

      const { cashAmount, cardAmount, totalAmount } = mixedPayment;

      if (Number(cashAmount) < 0 || Number(cardAmount) < 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi manfiy bo'lishi mumkin emas",
        });
      }

      if (Number(totalAmount) < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${totalAmount}`,
        });
      }
    } else {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi noto'g'ri yoki kiritilmagan",
        });
      }

      if (
        paymentMethod === "cash" &&
        Number(paymentAmount) < order.final_total
      ) {
        return res.status(400).json({
          success: false,
          message: `Naqd to'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${paymentAmount}`,
        });
      }
    }

    const paymentData = {};

    if (paymentMethod === "mixed") {
      paymentData.mixedPayment = {
        cashAmount: Number(mixedPayment.cashAmount),
        cardAmount: Number(mixedPayment.cardAmount),
        totalAmount: Number(mixedPayment.totalAmount),
        changeAmount: Number(changeAmount) || 0,
      };
      paymentData.paymentAmount = Number(mixedPayment.totalAmount);
      paymentData.changeAmount = Number(changeAmount) || 0;
    } else {
      paymentData.paymentAmount = Number(paymentAmount);
      paymentData.changeAmount = Number(changeAmount) || 0;
    }

    // ✅ TO'LOV QAYD QILISH
    await order.processPayment(userId, paymentMethod, notes, paymentData);

    // ✅ STOL STATUSINI BO'SH QILISH (TO'LOV TUGAGANDAN KEYIN)
    if (order.table_id) {
      const tableUpdateResult = await updateTableStatus(
        order.table_id,
        "bo'sh"
      );
      console.log(
        "📋 To'lov tugagach stol bo'shatish natijasi:",
        tableUpdateResult
      );
    }

    console.log("✅ To'lov muvaffaqiyatli qayd qilindi va stol bo'shatildi:", {
      order_number: order.formatted_order_number,
      payment_method: paymentMethod,
      total: order.final_total,
      payment_amount: paymentData.paymentAmount,
      change_amount: paymentData.changeAmount,
      kassir: userId,
      table_freed: true,
    });

    const response = {
      success: true,
      message: "To'lov muvaffaqiyatli qabul qilindi va stol bo'shatildi",

      order: {
        id: order._id,
        number: order.formatted_order_number,
        status: order.status,
        total: order.final_total,
        payment_method: order.paymentMethod,
        payment_amount: order.paymentAmount,
        change_amount: order.changeAmount,
        paid_at: order.paidAt,
        receipt_printed: order.receiptPrinted,
      },

      payment: {
        method: paymentMethod,
        amount: order.final_total,
        payment_amount: order.paymentAmount,
        change_amount: order.changeAmount,
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
        status: "bo'sh", // ✅ Yangi status
      },

      // ✅ STOL STATUSI MA'LUMOTI
      table_status: {
        updated: true,
        previous_status: "band",
        current_status: "bo'sh",
        message: "To'lov tugagach stol avtomatik bo'shatildi",
      },

      mixed_payment_details:
        paymentMethod === "mixed"
          ? {
              cash_amount: order.mixedPaymentDetails?.cashAmount || 0,
              card_amount: order.mixedPaymentDetails?.cardAmount || 0,
              total_amount: order.mixedPaymentDetails?.totalAmount || 0,
              change_amount: order.mixedPaymentDetails?.changeAmount || 0,
            }
          : null,

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
        paymentMethod: req.body.paymentMethod,
        paymentAmount: req.body.paymentAmount,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// ✅ KASSIR UCHUN CHEK CHIQARISH (unchanged)
const printReceiptForKassir = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

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

      printed_by_kassir: true,
      print_time: new Date().toISOString(),
      kassir_printer_ip: settings?.kassir_printer_ip,
    };

    console.log("🖨️ Kassir chek chiqarish:", {
      order_number: receiptData.formatted_order_number,
      printer_ip: settings?.kassir_printer_ip,
      kassir_user: userId,
    });

    const receiptResult = await printReceiptToKassir(receiptData);

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

// 🆕 YAXSHILANGAN getCompletedOrders funksiyasi - kalendar filter bilan
const getCompletedOrders = async (req, res) => {
  try {
    const { date, startDate, endDate, paid, current_user_only } = req.query;

    const userId = req.user?.id;

    console.log("📋 Completed orders request (CALENDAR FILTER):", {
      date,
      startDate,
      endDate,
      paid,
      current_user_only,
      userId,
    });

    // Date range logic
    let queryStartDate, queryEndDate;

    if (date) {
      queryStartDate = date;
      queryEndDate = date;
      console.log("📅 Single date filter:", { date });
    } else if (startDate && endDate) {
      queryStartDate = startDate;
      queryEndDate = endDate;
      console.log("📅 Date range filter:", { startDate, endDate });
    } else {
      const today = new Date().toISOString().split("T")[0];
      queryStartDate = today;
      queryEndDate = today;
      console.log("📅 Default today filter:", { today });
    }

    let query = {
      order_date: {
        $gte: queryStartDate,
        $lte: queryEndDate,
      },
    };

    if (current_user_only === "true" && userId) {
      query.user_id = userId;
      console.log("🔒 Faqat current user'ning zakaz'lari:", userId);
    }

    if (paid !== undefined) {
      query.status = paid === "true" ? "paid" : "completed";
    } else {
      query.status = { $in: ["completed", "paid"] };
    }

    console.log("🔍 Final MongoDB query:", JSON.stringify(query, null, 2));

    const orders = await Order.find(query)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("completedBy", "first_name last_name")
      .populate("paidBy", "first_name last_name")
      .sort({ completedAt: -1 })
      .limit(200);

    console.log("🔍 Raw orders from database:", {
      count: orders.length,
      date_range: `${queryStartDate} to ${queryEndDate}`,
      paid_param: paid,
      current_user_only: current_user_only,
      user_id: userId,
      first_order: orders[0]
        ? {
            id: orders[0]._id,
            status: orders[0].status,
            order_date: orders[0].order_date,
            formatted_number: orders[0].formatted_order_number,
            table_number: orders[0].table_number,
            final_total: orders[0].final_total,
            completedAt: orders[0].completedAt,
          }
        : null,
    });

    const totalAmount = orders.reduce((sum, order) => {
      return sum + (order.final_total || order.total_price || 0);
    }, 0);

    const paymentMethodStats = orders.reduce((stats, order) => {
      const method = order.paymentMethod || "not_paid";
      stats[method] = (stats[method] || 0) + 1;
      return stats;
    }, {});

    const response = {
      success: true,
      orders: orders.map((order) => ({
        id: order._id,
        orderNumber: order.formatted_order_number,
        tableNumber: order.table_number,
        waiterName: order.waiter_name,
        itemsCount: order.items?.length || 0,
        subtotal: order.total_price,
        serviceAmount: order.service_amount || 0,
        taxAmount: order.tax_amount || 0,
        finalTotal: order.final_total || order.total_price,
        completedAt: order.completedAt,
        paidAt: order.paidAt,
        status: order.status,
        receiptPrinted: order.receiptPrinted || false,
        paymentMethod: order.paymentMethod,
        paidBy: order.paidBy?.first_name || "Kassir",
        completedBy: order.completedBy?.first_name || order.waiter_name,
        items: order.items || [],
        order_date: order.order_date,
      })),

      total_count: orders.length,
      total_amount: totalAmount,

      filter: {
        start_date: queryStartDate,
        end_date: queryEndDate,
        date_range:
          queryStartDate === queryEndDate
            ? `Single date: ${queryStartDate}`
            : `Range: ${queryStartDate} to ${queryEndDate}`,
        status:
          paid === "true" ? "paid" : paid === "false" ? "completed" : "all",
        current_user_only: current_user_only === "true",
        user_id: current_user_only === "true" ? userId : "all",
      },

      payment_stats: {
        by_method: paymentMethodStats,
        total_cash: orders
          .filter((o) => o.paymentMethod === "cash")
          .reduce((sum, o) => sum + (o.final_total || 0), 0),
        total_card: orders
          .filter((o) => o.paymentMethod === "card")
          .reduce((sum, o) => sum + (o.final_total || 0), 0),
        total_mixed: orders
          .filter((o) => o.paymentMethod === "mixed")
          .reduce((sum, o) => sum + (o.final_total || 0), 0),
      },

      user_info:
        current_user_only === "true"
          ? {
              id: userId,
              name: orders[0]?.waiter_name || "Afitsant",
              period_orders: orders.length,
              period_revenue: totalAmount,
              period_range:
                queryStartDate === queryEndDate
                  ? `${queryStartDate}`
                  : `${queryStartDate} - ${queryEndDate}`,
            }
          : null,

      timestamp: new Date().toISOString(),
    };

    console.log("✅ Processed response (CALENDAR FILTER):", {
      orders_count: response.orders.length,
      date_range: response.filter.date_range,
      total_amount: response.total_amount,
      filter_status: response.filter.status,
      current_user_only: response.filter.current_user_only,
      payment_methods: Object.keys(response.payment_stats.by_method),
      completed_count: response.orders.filter((o) => o.status === "completed")
        .length,
      paid_count: response.orders.filter((o) => o.status === "paid").length,
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Completed orders olishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Completed orders olishda xatolik",
      error: err.message,
      debug: {
        query_params: req.query,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// ✅ PENDING PAYMENTS
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

    // ✅ Zakaz o'chirilishidan oldin stol statusini bo'sh qilish
    const order = await Order.findById(orderId);
    if (order && order.table_id) {
      await updateTableStatus(order.table_id, "bo'sh");
      console.log("✅ Zakaz o'chirildi va stol bo'shatildi:", order.table_id);
    }

    await Order.findByIdAndDelete(orderId);
    res.json({
      message: "Zakaz o'chirildi va stol bo'shatildi",
      table_status_updated: true,
    });
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
  updateTableStatus, // ✅ Export qo'shildi
};
