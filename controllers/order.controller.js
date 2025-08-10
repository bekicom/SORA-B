const Order = require("../models/Order");
const Food = require("../models/Food");
const Category = require("../models/Category");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Printer = require("../models/Printer");
const Table = require("../models/Table");
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
const closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const userId = req.user?.id || req.user?._id || req.user || null;
    console.log("🔍 User info:", {
      req_user: req.user,
      userId: userId,
      headers: req.headers.authorization,
    });

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

    console.log("📋 Order debug:", {
      order_id: order._id,
      user_id: order.user_id,
      status: order.status,
      existing_service_amount: order.service_amount,
      existing_waiter_percentage: order.waiter_percentage,
      existing_final_total: order.final_total,
    });

    if (["completed", "paid", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Zakaz allaqachon ${order.status} holatida`,
      });
    }

    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );

    // ✅ Authorization check
    if (
      userId &&
      order.user_id &&
      String(order.user_id._id || order.user_id) !== String(userId) &&
      req.user?.role !== "kassir"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Faqat buyurtmani ochgan afitsant yoki kassir zakazni yopishi mumkin",
      });
    }

    const waiter = order.user_id || null;
    const table = order.table_id;

    console.log("📋 Order ma'lumotlari:", {
      order_id: order._id,
      daily_number: order.daily_order_number,
      formatted_number: order.formatted_order_number,
      current_status: order.status,
      table_name: table?.name,
      waiter_name: waiter?.first_name || "Noma'lum",
      items_count: order.items?.length,
    });

    // ✅ TUZATILDI: Order yaratishda hisoblangan ma'lumotlarni ishlatish
    const subtotal = order.total_price;
    let serviceAmount = 0;
    let waiterPercent = 0;
    let waiterAmount = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    // ✅ Agar order yaratishda allaqachon hisoblangan bo'lsa, ularni ishlatish
    if (order.service_amount !== undefined && order.service_amount !== null) {
      serviceAmount = order.service_amount;
      console.log("✅ Mavjud service_amount ishlatildi:", serviceAmount);
    } else {
      // Faqat mavjud bo'lmasa qayta hisoblash
      const servicePercent = settings?.service_percent || 10;
      serviceAmount = Math.round((subtotal * servicePercent) / 100);
      console.log("⚠️ Service_amount qayta hisoblandi:", serviceAmount);
    }

    if (
      order.waiter_percentage !== undefined &&
      order.waiter_percentage !== null
    ) {
      waiterPercent = order.waiter_percentage;
      console.log("✅ Mavjud waiter_percentage ishlatildi:", waiterPercent);
    } else {
      // Faqat mavjud bo'lmasa qayta hisoblash
      waiterPercent = waiter ? Number(waiter.percent) || 0 : 0;
      console.log("⚠️ Waiter_percentage qayta hisoblandi:", waiterPercent);
    }

    // ✅ MUHIM: Waiter amount - bu order yaratishda allaqachon service_amount ga kiritilgan!
    // Alohida waiter_amount yo'q, chunki u service_amount ning bir qismi
    waiterAmount = Math.round((subtotal * waiterPercent) / 100);

    if (order.tax_amount !== undefined && order.tax_amount !== null) {
      taxAmount = order.tax_amount;
    } else {
      taxAmount = 0; // Hozircha soliq yo'q
    }

    if (order.final_total !== undefined && order.final_total !== null) {
      totalAmount = order.final_total;
      console.log("✅ Mavjud final_total ishlatildi:", totalAmount);
    } else {
      // ✅ TUZATILDI: To'g'ri hisoblash
      // Service amount allaqachon waiter percentage ni o'z ichiga oladi
      totalAmount = subtotal + serviceAmount + taxAmount;
      console.log("⚠️ Final_total qayta hisoblandi:", totalAmount);
    }

    console.log("💰 Financial breakdown:", {
      subtotal,
      serviceAmount: `${serviceAmount} (${waiterPercent}% afitsant foizi bilan)`,
      waiterPercent,
      waiterAmount: `${waiterAmount} (bu service_amount ning bir qismi)`,
      taxAmount,
      totalAmount,
      note: "Waiter amount service amount ga allaqachon kiritilgan",
    });

    // ✅ Order statusini yangilash
    order.status = "completed";
    order.completedAt = new Date();
    order.completedBy = userId || waiter?._id || "system";
    order.closedAt = order.completedAt;

    // ✅ Faqat mavjud bo'lmagan qiymatlarni saqlash
    if (order.service_amount === undefined || order.service_amount === null) {
      order.service_amount = serviceAmount;
    }
    if (order.tax_amount === undefined || order.tax_amount === null) {
      order.tax_amount = taxAmount;
    }
    if (
      order.waiter_percentage === undefined ||
      order.waiter_percentage === null
    ) {
      order.waiter_percentage = waiterPercent;
    }
    if (order.final_total === undefined || order.final_total === null) {
      order.final_total = totalAmount;
    }

    await order.save();

    console.log("💾 Order saved with values:", {
      waiter_percentage: order.waiter_percentage,
      service_amount: order.service_amount,
      final_total: order.final_total,
      completedBy: order.completedBy,
    });

    // ✅ Stol statusini bo'sh qilish
    if (order.table_id) {
      const tableUpdateResult = await updateTableStatus(
        order.table_id,
        "bo'sh"
      );
      console.log("📋 Stol statusi yangilash natijasi:", tableUpdateResult);
    }

    // ✅ Table info
    const tableDisplayInfo = table
      ? {
          id: table._id,
          name: table.name,
          number: table.number || table.name,
          display_name: table.display_name || table.name,
          status: "bo'sh",
        }
      : {
          id: order.table_id,
          name: order.table_number || "Noma'lum",
          number: order.table_number || "Noma'lum",
          display_name: order.table_number || "Noma'lum",
          status: "bo'sh",
        };

    // ✅ TUZATILDI: To'g'ri response structure
    const response = {
      success: true,
      message: "Zakaz yopildi, kassir bo'limiga yuborildi va stol bo'shatildi",

      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number: order.formatted_order_number,
        status: order.status,
        completed_at: order.completedAt,
        completed_by: waiter?.first_name || "System",
        service_amount: order.service_amount,
        tax_amount: order.tax_amount,
        waiter_percentage: order.waiter_percentage,
        final_total: order.final_total,
        order_date: order.order_date,
      },

      table: tableDisplayInfo,

      waiter: {
        id: waiter?._id || null,
        name: waiter?.first_name || "Noma'lum",
        percent: order.waiter_percentage || 0,
        earned_amount: waiterAmount,
        note:
          order.waiter_percentage > 0
            ? `Afitsant ${order.waiter_percentage}% oladi (service_amount ga kiritilgan)`
            : "Afitsant foizi belgilanmagan",
      },

      kassir_workflow: {
        enabled: true,
        status: "pending_payment",
        next_step: "Kassir to'lov qabul qilishi kerak",
        receipt_printed: false,
        auto_print_disabled: true,
      },

      table_status: {
        updated: true,
        previous_status: "band",
        current_status: "bo'sh",
        message: "Stol avtomatik ravishda bo'shatildi",
      },

      totals: {
        subtotal,
        service: `${order.waiter_percentage || 0}% = ${order.service_amount}`,
        tax: `0% = ${order.tax_amount}`,
        waiter_info: `Afitsant foizi service_amount ga kiritilgan`,
        total: order.final_total,
        currency: settings?.currency || "UZS",
        breakdown: {
          food_cost: subtotal,
          service_fee: order.service_amount,
          tax_fee: order.tax_amount,
          waiter_note: "Afitsant foizi service_fee ga kiritilgan",
          grand_total: order.final_total,
        },
      },

      // ✅ Consistency check
      consistency_check: {
        create_time_totals: {
          service_amount: order.service_amount,
          waiter_percentage: order.waiter_percentage,
          final_total: order.final_total,
        },
        close_time_totals: {
          service_amount: serviceAmount,
          waiter_percentage: waiterPercent,
          final_total: totalAmount,
        },
        is_consistent:
          order.service_amount === serviceAmount &&
          order.final_total === totalAmount &&
          order.waiter_percentage === waiterPercent,
        note: "Create va close vaqtidagi hisob-kitoblar bir xil bo'lishi kerak",
      },

      debug: {
        workflow: "using_existing_order_calculations",
        auto_print: false,
        table_status_updated: true,
        calculation_source: "from_order_creation_time",
        user_info: {
          userId: userId,
          req_user_exists: !!req.user,
          waiter_exists: !!waiter,
          waiter_id: waiter?._id || null,
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
        user_info: {
          req_user: req.user,
          headers_auth: req.headers.authorization,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
};

const createOrder = async (req, res) => {
  const session = await Food.startSession();
  session.startTransaction();

  try {
    const { table_id, user_id, items, total_price, first_name } = req.body;
    console.log("📝 Yangi zakaz ma'lumotlari:", req.body);

    // ✅ Input validation
    if (!user_id) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Afitsant ID kerak" });
    }

    if (!table_id) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Stol ID kerak" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Kamida bitta taom kerak" });
    }

    if (!total_price || total_price <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "To'g'ri narx kiriting" });
    }

    // Afitsantni tekshirish
    const waiter = await User.findById(user_id).lean();
    if (!waiter) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Afitsant topilmadi" });
    }

    if (!waiter.is_active) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Afitsant faol emas" });
    }

    const waiterPercentage = waiter?.percent ? Number(waiter.percent) : 0;
    const serviceAmount =
      Math.round(total_price * (waiterPercentage / 100) * 100) / 100;
    const taxAmount = 0;
    const finalTotal =
      Math.round((total_price + serviceAmount + taxAmount) * 100) / 100;

    // Stolni tekshirish
    const table = await Table.findById(table_id).session(session);
    if (!table) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Stol topilmadi" });
    }

    const tableNumber = table?.number || table?.name || req.body.table_number;

    // Taomlarni tekshirish va miqdorni yangilash
    const updatedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const { food_id, quantity } = item;
      const food = await Food.findById(food_id)
        .populate("category")
        .session(session);

      if (!food || food.soni < quantity || !food.price || food.price <= 0) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ message: `Taomda muammo: ${food?.name || food_id}` });
      }

      food.soni -= quantity;
      await food.save({ session });

      const itemTotal = food.price * quantity;
      calculatedTotal += itemTotal;

      updatedItems.push({
        food_id,
        name: food.name,
        price: food.price,
        quantity,
        total: itemTotal,
        category_name: food.category?.title,
        printer_id: food.category?.printer_id,
        printer_ip: food.category?.printer?.ip,
        printer_name: food.category?.printer?.name,
      });
    }

    // Buyurtma yaratish
    const newOrderArr = await Order.create(
      [
        {
          table_id,
          user_id,
          items: updatedItems,
          table_number: tableNumber,
          total_price: calculatedTotal,
          status: "pending",
          waiter_name: first_name || `${waiter.first_name} ${waiter.last_name}`,
          waiter_percentage: waiterPercentage,
          service_amount: serviceAmount,
          tax_amount: taxAmount,
          final_total: finalTotal,
          created_at: new Date(),
          order_type: "dine_in",
          payment_status: "unpaid",
          notes: req.body.notes || null,
        },
      ],
      { session }
    );
    const newOrder = newOrderArr[0];

    // Stol statusini yangilash
    try {
      await updateTableStatus(table_id, "band");
    } catch (tableError) {
      console.error("❌ Stol statusini yangilashda xatolik:", tableError);
    }

    await session.commitTransaction();

    // Printerga yuborish
    const printResults = await handlePrinting(
      printerGroups,
      tableNumber,
      waiter,
      newOrder,
      calculatedTotal,
      serviceAmount,
      finalTotal
    );

    // Socket.io orqali real-time yangilanishlar
    const io = req.app.get("io");
    if (io) {
      try {
        // 1. Yangi buyurtma haqida xabar berish
        io.emit("new_order", {
          type: "NEW_ORDER",
          order: newOrder,
          table: {
            id: table_id,
            number: tableNumber,
            status: "band",
          },
          waiter: {
            id: user_id,
            name: first_name || `${waiter.first_name} ${waiter.last_name}`,
          },
          timestamp: new Date(),
        });

        // 2. Barcha pending buyurtmalarni yangilash
        const pendingOrders = await Order.find({ status: "pending" })
          .sort({ createdAt: -1 })
          .lean();

        io.emit("update_pending_orders", {
          type: "PENDING_ORDERS_UPDATE",
          orders: pendingOrders,
          count: pendingOrders.length,
          updatedAt: new Date(),
        });

        // 3. Stol holatini yangilash
        io.emit("table_status_changed", {
          type: "TABLE_STATUS",
          tableId: table_id,
          status: "band",
          orderId: newOrder._id,
          waiterId: user_id,
        });

        console.log("📢 Socket.io orqali yangilanishlar yuborildi");
      } catch (socketError) {
        console.error("❌ Socket.io xatosi:", socketError);
      }
    }

    // Javobni yuborish
    const response = {
      success: true,
      message: "Zakaz muvaffaqiyatli yaratildi",
      order: newOrder,
      printing: printResults,
    };

    res.status(201).json(response);
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Zakaz yaratishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Zakaz yaratishda xatolik",
      error: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// Printerga yuborish uchun alohida funksiya
async function handlePrinting(
  printerGroups,
  tableNumber,
  waiter,
  newOrder,
  calculatedTotal,
  serviceAmount,
  finalTotal
) {
  const printResults = [];

  for (const [printerIp, group] of Object.entries(printerGroups)) {
    const payload = {
      items: group.items,
      table_number: tableNumber,
      waiter_name: waiter.first_name + " " + waiter.last_name,
      date: new Date().toLocaleString("uz-UZ"),
      order_id: newOrder._id.toString(),
      order_number:
        newOrder.formatted_order_number ||
        `#${newOrder._id.toString().slice(-6)}`,
      total_amount: calculatedTotal,
      service_amount: serviceAmount,
      final_total: finalTotal,
    };

    try {
      const result = await printToPrinter(printerIp, payload);
      printResults.push({
        printer_ip: printerIp,
        success: true,
        ...result,
      });
    } catch (error) {
      printResults.push({
        printer_ip: printerIp,
        success: false,
        error: error.message,
      });
    }
  }

  return printResults;
}

const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, paymentAmount, changeAmount, mixedPayment, notes } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.first_name || 'Kassir';

    console.log("💰 To'lov qabul qilish - req.body:", req.body);
    console.log("💰 Payment method received:", paymentMethod);
    console.log("💰 Payment method type:", typeof paymentMethod);

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
        message: "Faqat yopilgan yoki qayta ochildi zakaz'lar uchun to'lov qabul qilish mumkin",
        current_status: order.status,
      });
    }

    // ✅ TUZATISH: paymentMethod'ni to'g'ri olish
    // Frontend'dan kelayotgan ma'lumotni tekshirish
    let actualPaymentMethod = paymentMethod;
    
    // Agar req.body ichida paymentData bor bo'lsa, undan olish
    if (req.body.paymentData && req.body.paymentData.paymentMethod) {
      actualPaymentMethod = req.body.paymentData.paymentMethod;
    }
    
    console.log("💰 Actual payment method:", actualPaymentMethod);

    // ✅ YANGILANGAN TO'LOV USULLARI VALIDATSIYASI
    const validPaymentMethods = ["cash", "card", "click", "transfer", "mixed"];
    if (!validPaymentMethods.includes(actualPaymentMethod)) {
      console.error("❌ Invalid payment method received:", {
        received: actualPaymentMethod,
        type: typeof actualPaymentMethod,
        valid_methods: validPaymentMethods,
        full_req_body: req.body
      });
      
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri to'lov usuli",
        received_method: actualPaymentMethod,
        valid_methods: validPaymentMethods,
        available_methods: {
          cash: "Naqd to'lov",
          card: "Bank kartasi",
          click: "Click to'lov",
          transfer: "Bank o'tkazmasi",
          mixed: "Aralash to'lov (naqd + karta)"
        }
      });
    }

    // ✅ ARALASH TO'LOV VALIDATSIYASI
    if (actualPaymentMethod === "mixed") {
      let mixedPaymentData = mixedPayment;
      
      // Agar req.body.paymentData ichida bo'lsa
      if (req.body.paymentData && req.body.paymentData.mixedPayment) {
        mixedPaymentData = req.body.paymentData.mixedPayment;
      }
      
      if (!mixedPaymentData) {
        return res.status(400).json({
          success: false,
          message: "Aralash to'lov uchun mixedPayment ma'lumotlari kerak",
        });
      }

      const { cashAmount = 0, cardAmount = 0 } = mixedPaymentData;

      if (Number(cashAmount) < 0 || Number(cardAmount) < 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summalari manfiy bo'lishi mumkin emas",
          debug: { cashAmount, cardAmount }
        });
      }

      if (Number(cashAmount) === 0 || Number(cardAmount) === 0) {
        return res.status(400).json({
          success: false,
          message: "Aralash to'lov uchun naqd va karta ikkalasi ham bo'lishi kerak",
          provided: { cash: cashAmount, card: cardAmount }
        });
      }

      const calculatedTotal = Number(cashAmount) + Number(cardAmount);
      
      if (calculatedTotal < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${calculatedTotal}`,
          shortage: order.final_total - calculatedTotal,
        });
      }

    } else {
      // ✅ ODDIY TO'LOV VALIDATSIYASI
      let actualPaymentAmount = paymentAmount;
      
      // paymentData ichidan olish
      if (req.body.paymentData && req.body.paymentData.paymentAmount) {
        actualPaymentAmount = req.body.paymentData.paymentAmount;
      }
      
      if (!actualPaymentAmount || Number(actualPaymentAmount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi noto'g'ri yoki kiritilmagan",
          received_amount: actualPaymentAmount
        });
      }

      if (actualPaymentMethod === "cash") {
        if (Number(actualPaymentAmount) < order.final_total) {
          return res.status(400).json({
            success: false,
            message: `Naqd to'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${actualPaymentAmount}`,
          });
        }
      } else {
        // ✅ Karta, Click va Transfer uchun aniq summa
        if (Math.abs(Number(actualPaymentAmount) - order.final_total) > 1) {
          return res.status(400).json({
            success: false,
            message: `${
              actualPaymentMethod === 'card' ? 'Karta' : 
              actualPaymentMethod === 'click' ? 'Click' : 
              actualPaymentMethod === 'transfer' ? 'Transfer' : actualPaymentMethod
            } to'lov aniq summa bo'lishi kerak`,
            required: order.final_total,
            provided: actualPaymentAmount,
            method: actualPaymentMethod
          });
        }
      }
    }

    // ✅ TO'LOV MA'LUMOTLARINI TAYYORLASH
    const paymentData = {
      paymentMethod: actualPaymentMethod,
      notes: notes || req.body.paymentData?.notes
    };

    if (actualPaymentMethod === "mixed") {
      let mixedPaymentData = mixedPayment || req.body.paymentData?.mixedPayment;
      const { cashAmount = 0, cardAmount = 0 } = mixedPaymentData;
      const calculatedTotal = Number(cashAmount) + Number(cardAmount);
      
      paymentData.mixedPayment = {
        cashAmount: Number(cashAmount),
        cardAmount: Number(cardAmount),
        totalAmount: calculatedTotal,
        changeAmount: Number(changeAmount) || Number(req.body.paymentData?.changeAmount) || 0,
      };
      paymentData.paymentAmount = calculatedTotal;
      paymentData.changeAmount = Number(changeAmount) || Number(req.body.paymentData?.changeAmount) || 0;
    } else {
      let actualPaymentAmount = paymentAmount || req.body.paymentData?.paymentAmount;
      let actualChangeAmount = changeAmount || req.body.paymentData?.changeAmount;
      
      paymentData.paymentAmount = Number(actualPaymentAmount);
      paymentData.changeAmount = Number(actualChangeAmount) || 0;
    }

    console.log("💰 Final payment data:", paymentData);

    // ✅ 1. ORDER'DA TO'LOVNI QAYD QILISH
    await order.processPayment(userId, actualPaymentMethod, paymentData.notes, paymentData);

    // ✅ 2. ALOHIDA PAYMENT BAZASIGA SAQLASH
    let paymentRecord = null;
    try {
      const { savePaymentToDatabase } = require('./paymentController');
      paymentRecord = await savePaymentToDatabase(order, paymentData, userId, userName);
      console.log('✅ To\'lov payment jadvaliga saqlandi:', paymentRecord?._id);
    } catch (paymentSaveError) {
      console.error('❌ Payment jadvaliga saqlashda xatolik:', paymentSaveError);
      // Bu xatolik order'ni buzmasin, faqat log qilamiz
    }

    // ✅ 3. STOL STATUSINI BO'SH QILISH
    if (order.table_id) {
      const tableUpdateResult = await updateTableStatus(order.table_id, "bo'sh");
      console.log("📋 To'lov tugagach stol bo'shatish natijasi:", tableUpdateResult);
    }

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
        id: paymentRecord?._id,
        method: actualPaymentMethod,
        amount: order.final_total,
        payment_amount: order.paymentAmount,
        change_amount: order.changeAmount,
        currency: "UZS",
        notes: paymentData.notes || null,
        processed_at: order.paidAt,
        processed_by: userId,
        saved_to_payment_db: !!paymentRecord,
      },

      waiter: {
        name: order.user_id?.first_name,
        completed_by: order.completedBy?.first_name,
      },

      table: {
        number: order.table_id?.number || order.table_number,
        name: order.table_id?.name,
        status: "bo'sh",
      },

      table_status: {
        updated: true,
        previous_status: "band",
        current_status: "bo'sh",
        message: "To'lov tugagach stol avtomatik bo'shatildi",
      },

      mixed_payment_details: actualPaymentMethod === "mixed" ? {
        cash_amount: order.mixedPaymentDetails?.cashAmount || 0,
        card_amount: order.mixedPaymentDetails?.cardAmount || 0,
        total_amount: order.mixedPaymentDetails?.totalAmount || 0,
        change_amount: order.mixedPaymentDetails?.changeAmount || 0,
      } : null,

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
        paymentData: req.body.paymentData,
        full_body: req.body,
        timestamp: new Date().toISOString(),
      },
    });
  }
};





// ✅ KASSIR UCHUN CHEK CHIQARISH
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

// ✅ COMPLETED ORDERS
const getCompletedOrders = async (req, res) => {
  try {
    const { date, startDate, endDate, paid, current_user_only } = req.query;
    const userId = req.user?.id;

    console.log("📋 Completed orders request:", {
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
    } else if (startDate && endDate) {
      queryStartDate = startDate;
      queryEndDate = endDate;
    } else {
      const today = new Date().toISOString().split("T")[0];
      queryStartDate = today;
      queryEndDate = today;
    }

    let query = {
      order_date: {
        $gte: queryStartDate,
        $lte: queryEndDate,
      },
    };

    if (current_user_only === "true" && userId) {
      query.user_id = userId;
    }

    if (paid !== undefined) {
      query.status = paid === "true" ? "paid" : "completed";
    } else {
      query.status = { $in: ["completed", "paid"] };
    }

    const orders = await Order.find(query)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("completedBy", "first_name last_name")
      .populate("paidBy", "first_name last_name")
      .sort({ completedAt: -1 })
      .limit(200);

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
        total_click: orders
          .filter((o) => o.paymentMethod === "click")
          .reduce((sum, o) => sum + (o.final_total || 0), 0),
        total_mixed: orders
          .filter((o) => o.paymentMethod === "mixed")
          .reduce((sum, o) => sum + (o.final_total || 0), 0),
      },

      timestamp: new Date().toISOString(),
    };

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
    // ✅ TAOMLAR BILAN BIRGALIKDA OLISH
    const orders = await Order.find({
      status: { $in: ["completed", "ready_for_payment"] },
    })
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("items.food_id", "name category price image") // Taom ma'lumotlarini ham olish
      .sort({ completedAt: -1 })
      .lean();

    const response = {
      success: true,
      pending_orders: orders.map((order) => ({
        id: order._id,
        _id: order._id,
        orderNumber: order.formatted_order_number,
        tableNumber:
          order.table_number || order.table_id?.number || order.table_id?.name,
        waiterName: order.waiter_name || order.user_id?.first_name,
        itemsCount: order.items?.length || 0,

        // ✅ TAOMLAR RO'YXATI QO'SHILDI
        items: (order.items || []).map((item) => ({
          food_id: item.food_id?._id || item.food_id,
          name: item.name || item.food_id?.name || "Noma'lum taom",
          price: item.price || item.food_id?.price || 0,
          quantity: item.quantity || 1,
          total: item.total || item.price * item.quantity || 0,
          category_name:
            item.category_name || item.food_id?.category || "Kategoriya",
          image: item.food_id?.image || null,
          special_instructions: item.special_instructions || null,
        })),

        subtotal: order.total_price,
        serviceAmount: order.service_amount || 0,
        taxAmount: order.tax_amount || 0,
        finalTotal: order.final_total || order.total_price,
        completedAt: order.completedAt,
        status: order.status,
        receiptPrinted: order.receiptPrinted || false,
        paymentMethod: order.paymentMethod,
        kassirNotes: order.kassirNotes,

        // ✅ QO'SHIMCHA MA'LUMOTLAR
        customerCount: order.customerCount || 1,
        specialRequests: order.specialRequests || null,
        createdAt: order.createdAt,
        order_date: order.order_date,

        // Afitsiant ma'lumotlari
        waiter: {
          id: order.user_id?._id,
          name: order.user_id?.first_name || order.waiter_name,
          percentage: order.waiter_percentage || 0,
        },

        // Stol ma'lumotlari
        table: {
          id: order.table_id?._id,
          name: order.table_id?.name || order.table_number,
          number: order.table_id?.number || order.table_number,
        },
      })),

      total_pending: orders.length,
      total_amount: orders.reduce(
        (sum, order) => sum + (order.final_total || order.total_price || 0),
        0
      ),
      currency: "UZS",
      timestamp: new Date().toISOString(),

      // ✅ STATISTIKA QO'SHILDI
      statistics: {
        total_orders: orders.length,
        total_items: orders.reduce(
          (sum, order) => sum + (order.items?.length || 0),
          0
        ),
        avg_order_value:
          orders.length > 0
            ? Math.round(
                orders.reduce(
                  (sum, order) => sum + (order.final_total || 0),
                  0
                ) / orders.length
              )
            : 0,
        oldest_order:
          orders.length > 0 ? orders[orders.length - 1].completedAt : null,
      },
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

// ✅ QOLGAN FUNKSIYALAR
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
    const userRole = req.user.role;

    let query = {};

    if (userRole === "kassir") {
      query = {
        status: { $in: ["pending", "preparing", "ready", "served"] },
      };
    } else {
      query = {
        user_id: userId,
        status: "pending",
      };
    }

    const orders = await Order.find(query)
      .populate("table_id", "name number")
      .populate("user_id", "first_name last_name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders: orders,
      total_count: orders.length,
      user_role: userRole,
    });
  } catch (error) {
    console.error("Orders error:", error);
    res.status(500).json({
      success: false,
      message: "Serverda xatolik yuz berdi",
    });
  }
};

const printReceipt = async (req, res) => {
  return await printReceiptForKassir(req, res);
};





const cancelOrderItem = async (req, res) => {
  const session = await Order.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { food_id, cancel_quantity, reason, notes } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.first_name || "Foydalanuvchi";
    const userRole = req.user?.role;

    // ✅ Input validation
    if (!food_id) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Taom ID kiritilishi kerak" });
    }
    if (!cancel_quantity || cancel_quantity <= 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({
          success: false,
          message: "Atmen qilinadigan miqdor noto'g'ri",
        });
    }
    if (!reason) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({
          success: false,
          message: "Atmen qilish sababi kiritilishi kerak",
        });
    }

    // ✅ Buyurtmani topish
    const order = await Order.findById(orderId)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Buyurtma topilmadi" });
    }

    // ✅ Status tekshirish
    if (
      !["pending", "preparing", "ready", "served", "completed"].includes(
        order.status
      )
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Faqat faol buyurtmalardan taom atmen qilish mumkin",
        current_status: order.status,
      });
    }

    // ✅ Ruxsat tekshirish
    if (userRole !== "kassir" && String(order.user_id._id) !== String(userId)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message:
          "Faqat buyurtmani bergan ofitsiant yoki kassir taom atmen qila oladi",
      });
    }

    // ✅ Item topish
    const itemIndex = order.items.findIndex(
      (item) => String(item.food_id) === String(food_id)
    );
    if (itemIndex === -1) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Ushbu taom buyurtmada topilmadi" });
    }

    const orderItem = order.items[itemIndex];
    const currentQuantity = orderItem.quantity;

    if (cancel_quantity > currentQuantity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Atmen qilinadigan miqdor buyurtmadagi miqdordan ko'p bo'lmasligi kerak. Mavjud: ${currentQuantity}`,
      });
    }

    // ✅ Taomni ombordan topish
    const food = await Food.findById(food_id).session(session);
    if (!food) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Taom ma'lumotlari topilmadi" });
    }

    // ✅ Hisob-kitoblar
    const cancelledAmount = orderItem.price * cancel_quantity;
    const oldTotal = order.total_price;
    const newTotal = oldTotal - cancelledAmount;
    const waiterPercentage = order.waiter_percentage || 0;
    const newServiceAmount = Math.round(newTotal * (waiterPercentage / 100));
    const newFinalTotal = newTotal + newServiceAmount + (order.tax_amount || 0);

    // ✅ Itemni yangilash yoki o‘chirish
    if (cancel_quantity === currentQuantity) {
      order.items.splice(itemIndex, 1); // faqat o‘chiradi
    } else {
      order.items[itemIndex].quantity -= cancel_quantity;
      order.items[itemIndex].total =
        order.items[itemIndex].price * order.items[itemIndex].quantity;
    }

    // ✅ Buyurtma summalarini yangilash
    order.total_price = newTotal;
    order.service_amount = newServiceAmount;
    order.final_total = newFinalTotal;

    // ✅ Atmen tarixiga qo‘shish
    order.cancelled_items = order.cancelled_items || [];
    order.cancelled_items.push({
      food_id,
      name: orderItem.name,
      price: orderItem.price,
      cancelled_quantity: cancel_quantity,
      cancelled_amount: cancelledAmount,
      reason,
      notes: notes || null,
      cancelled_by: userId,
      cancelled_by_name: userName,
      cancelled_at: new Date(),
    });

    // ❌ Bu joy olib tashlandi: oxirgi item bo‘lsa ham order cancel bo‘lmasin

    await order.save({ session });

    // ✅ Omborga qaytarish
    food.soni += cancel_quantity;
    await food.save({ session });

    await session.commitTransaction();

    // ✅ Javob
    res.status(200).json({
      success: true,
      message: "Taom muvaffaqiyatli atmen qilindi",
      order: {
        id: order._id,
        status: order.status,
        items_count: order.items.length,
        new_totals: {
          subtotal: order.total_price,
          service_amount: order.service_amount,
          final_total: order.final_total,
        },
      },
      cancelled_item: {
        food_id,
        name: orderItem.name,
        price: orderItem.price,
        cancelled_quantity: cancel_quantity,
        cancelled_amount: cancelledAmount,
        reason,
        notes,
      },
      inventory_update: {
        food_name: food.name,
        quantity_returned: cancel_quantity,
        new_stock_level: food.soni,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: "Taom atmen qilishda xatolik",
      error: error.message,
    });
  } finally {
    await session.endSession();
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
  printReceiptForKassir,
  processPayment,
  getCompletedOrders,
  getPendingPayments,
  getDailySalesSummary,
  updateTableStatus,
  cancelOrderItem,
};
