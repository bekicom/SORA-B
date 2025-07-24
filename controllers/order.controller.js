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

// ✅ ZAKASNI YOPISH - KASSIR WORKFLOW
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
      waiter_name: waiter?.first_name,
      items_count: order.items?.length,
    });

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

    order.status = "completed";
    order.completedAt = new Date();
    order.completedBy = userId;
    order.closedAt = order.completedAt;
    order.service_amount = serviceAmount;
    order.tax_amount = taxAmount;
    order.final_total = totalAmount;
    await order.save();

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

    const response = {
      success: true,
      message: "Zakaz yopildi va kassir bo'limiga yuborildi",
      order: {
        id: order._id,
        daily_order_number: order.daily_order_number,
        formatted_order_number: order.formatted_order_number,
        status: order.status,
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
        auto_print_disabled: true,
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
      payment_method: order.paymentMethod || "unknown",
      cash_amount: order.paymentDetails?.cashAmount || 0,
      card_amount: order.paymentDetails?.cardAmount || 0,
      total_payment: order.paymentDetails?.totalAmount || order.final_total,
      change_amount: order.paymentDetails?.changeAmount || 0,
      payment_breakdown:
        order.paymentMethod === "mixed"
          ? {
              cash: `${(
                order.paymentDetails?.cashAmount || 0
              ).toLocaleString()} UZS`,
              card: `${(
                order.paymentDetails?.cardAmount || 0
              ).toLocaleString()} UZS`,
            }
          : null,
    };

    console.log("🖨️ Kassir chek chiqarish:", {
      order_number: receiptData.formatted_order_number,
      printer_ip: settings?.kassir_printer_ip,
      kassir_user: userId,
      payment_method: receiptData.payment_method,
      cash_amount: receiptData.cash_amount,
      card_amount: receiptData.card_amount,
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
        payment_method: order.paymentMethod,
        cash_amount: order.paymentDetails?.cashAmount || 0,
        card_amount: order.paymentDetails?.cardAmount || 0,
        total_payment: order.paymentDetails?.totalAmount || order.final_total,
        change_amount: order.paymentDetails?.changeAmount || 0,
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

// ✅ KASSIR WORKFLOW - To'lov qabul qilish (TUZATILGAN)
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

    if (order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Faqat yopilgan zakaz'lar uchun to'lov qabul qilish mumkin",
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

    // ✅ MIXED PAYMENT VALIDATION
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
        });
      }

      const { cashAmount, cardAmount, totalAmount } = mixedPayment;
      if (cashAmount < 0 || cardAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi manfiy bo'lishi mumkin emas",
        });
      }

      if (totalAmount < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${totalAmount}`,
        });
      }

      if (Math.abs(totalAmount - (cashAmount + cardAmount)) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Cash va card summalari jami totalAmount ga teng bo'lishi kerak! Cash: ${cashAmount}, Card: ${cardAmount}, Total: ${totalAmount}`,
        });
      }
    } else {
      // ✅ SINGLE PAYMENT VALIDATION
      if (!paymentAmount || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi noto'g'ri",
          debug: {
            paymentAmount,
            type: typeof paymentAmount,
          },
        });
      }

      if (paymentMethod === "cash" && paymentAmount < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${paymentAmount}`,
        });
      }
    }

    // ✅ ASOSIY TUZATISH: paymentData obyektini to'g'ri shakllantiramiz
    const paymentData = {
      paymentAmount,
      changeAmount,
    };

    // Mixed payment uchun qo'shimcha ma'lumot
    if (paymentMethod === "mixed") {
      paymentData.mixedPayment = mixedPayment;
    }

    console.log("📝 Payment data prepared:", {
      paymentData,
      paymentMethod,
      notes,
      userId,
    });

    // ✅ TO'G'RI chaqiruv
    const result = await order.processPayment(
      userId, // paidBy
      paymentMethod, // paymentMethod
      notes, // notes
      paymentData // paymentData obyekti (oldin mixedPayment yuborilgan edi)
    );

    console.log("✅ To'lov muvaffaqiyatli qayd qilindi:", {
      order_number: order.formatted_order_number,
      payment_method: paymentMethod,
      total: order.final_total,
      cash_amount: mixedPayment?.cashAmount || 0,
      card_amount: mixedPayment?.cardAmount || 0,
      change_amount: changeAmount || 0,
      kassir: userId,
    });

    const response = {
      success: true,
      message: "To'lov muvaffaqiyatli qabul qilindi",
      order: {
        id: order._id,
        number: order.formatted_order_number,
        status: order.status,
        total: order.final_total,
        payment_method: paymentMethod,
        cash_amount: mixedPayment?.cashAmount || 0,
        card_amount: mixedPayment?.cardAmount || 0,
        total_payment: mixedPayment?.totalAmount || paymentAmount,
        change_amount: changeAmount || 0,
        paid_at: order.paidAt,
        receipt_printed: order.receiptPrinted,
      },
      payment: {
        method: paymentMethod,
        amount: order.final_total,
        cash_amount: mixedPayment?.cashAmount || 0,
        card_amount: mixedPayment?.cardAmount || 0,
        total_payment: mixedPayment?.totalAmount || paymentAmount,
        change_amount: changeAmount || 0,
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

// ✅ YOPILGAN ZAKAZLARNI OLISH (TUZATILGAN)
const getCompletedOrders = async (req, res) => {
  try {
    const { date, paid, current_user_only } = req.query;
    const userId = req.user?.id;

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

    let query = {
      order_date: { $gte: options.startDate, $lte: options.endDate },
    };

    if (options.current_user_only && userId) {
      query.user_id = userId;
      console.log("🔒 Faqat current user'ning zakaz'lari:", userId);
    }

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
      .sort({ completedAt: -1, paidAt: -1 }) // ✅ paidAt ham qo'shildi
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
            payment_method: orders[0].paymentMethod,
            payment_amount: orders[0].paymentAmount,
            mixed_payment_details: orders[0].mixedPaymentDetails,
            items_length: orders[0].items?.length,
          }
        : null,
    });

    const response = {
      success: true,
      orders: orders.map((order) => {
        // ✅ Mixed payment details ni to'g'ri map qilamiz
        const orderData = {
          id: order._id,
          _id: order._id, // Frontend uchun
          orderNumber: order.formatted_order_number,
          order_number: order.formatted_order_number, // Alternative field name
          tableNumber: order.table_number,
          table_number: order.table_number, // Alternative field name
          waiterName: order.waiter_name,
          itemsCount: order.items?.length || 0,
          subtotal: order.total_price,
          serviceAmount: order.service_amount || 0,
          taxAmount: order.tax_amount || 0,
          finalTotal: order.final_total || order.total_price,
          final_total: order.final_total || order.total_price, // Alternative field name
          total_price: order.total_price, // Alternative field name
          completedAt: order.completedAt,
          paidAt: order.paidAt,
          status: order.status,
          receiptPrinted: order.receiptPrinted || false,
          paymentMethod: order.paymentMethod,
          paymentAmount: order.paymentAmount || 0,
          changeAmount: order.changeAmount || 0,
          paidBy: order.paidBy?.first_name || "Kassir",
          completedBy: order.completedBy?.first_name || order.waiter_name,
        };

        // ✅ Mixed payment details ni to'g'ri qo'shamiz
        if (order.paymentMethod === "mixed" && order.mixedPaymentDetails) {
          orderData.mixed_payment_details = {
            cash_amount: order.mixedPaymentDetails.cashAmount || 0,
            card_amount: order.mixedPaymentDetails.cardAmount || 0,
            total_amount: order.mixedPaymentDetails.totalAmount || 0,
            change_amount: order.mixedPaymentDetails.changeAmount || 0,
            breakdown: {
              cash_percentage:
                order.mixedPaymentDetails.breakdown?.cash_percentage || "0.0",
              card_percentage:
                order.mixedPaymentDetails.breakdown?.card_percentage || "0.0",
            },
            timestamp: order.mixedPaymentDetails.timestamp,
          };

          // Alternative field names for compatibility
          orderData.cashAmount = order.mixedPaymentDetails.cashAmount || 0;
          orderData.cardAmount = order.mixedPaymentDetails.cardAmount || 0;
          orderData.totalPayment = order.mixedPaymentDetails.totalAmount || 0;
        } else {
          // Single payment method
          orderData.cashAmount =
            order.paymentMethod === "cash" ? order.paymentAmount : 0;
          orderData.cardAmount =
            order.paymentMethod === "card" ? order.paymentAmount : 0;
          orderData.totalPayment = order.paymentAmount || order.final_total;
        }

        return orderData;
      }),
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
      mixed_payments_count: response.orders.filter(
        (o) => o.paymentMethod === "mixed"
      ).length,
      first_processed_order: response.orders[0]
        ? {
            id: response.orders[0].id,
            orderNumber: response.orders[0].orderNumber,
            tableNumber: response.orders[0].tableNumber,
            waiterName: response.orders[0].waiterName,
            status: response.orders[0].status,
            finalTotal: response.orders[0].finalTotal,
            paymentMethod: response.orders[0].paymentMethod,
            mixed_payment: response.orders[0].mixed_payment_details
              ? "YES"
              : "NO",
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

// ✅ KUTILAYOTGAN TO'LOVLAR
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
        paymentMethod: order.paymentDetails?.paymentMethod,
        cashAmount: order.paymentDetails?.cashAmount || 0,
        cardAmount: order.paymentDetails?.cardAmount || 0,
        totalPayment: order.paymentDetails?.totalAmount || order.final_total,
        changeAmount: order.paymentDetails?.changeAmount || 0,
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

// ✅ QOLGAN FUNKSIYALAR
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

const printReceipt = async (req, res) => {
  return await printReceiptForKassir(req, res);
};



// ✅ ENHANCED updateOrder function - controller'ga qo'shing
const updateOrder = async (req, res) => {
  try {
    const { order_id, new_items = [], updated_items = [], total_price } = req.body;

    console.log("📝 Order update request:", {
      order_id,
      new_items_count: new_items.length,
      updated_items_count: updated_items.length,
      total_price
    });

    // Order'ni topish
    const order = await Order.findById(order_id)
      .populate("user_id")
      .populate("table_id")
      .populate("items.food_id");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Zakaz topilmadi"
      });
    }

    // Order status tekshirish
    if (["completed", "paid", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Zakaz ${order.status} holatida, o'zgartirib bo'lmaydi`
      });
    }

    let printResults = [];
    let updatedTotalPrice = order.total_price;

    // ✅ 1. YANGI TAOMLARNI QO'SHISH
    if (new_items.length > 0) {
      console.log("➕ Yangi taomlar qo'shilmoqda:", new_items.length);

      const updatedNewItems = [];
      
      for (const item of new_items) {
        const { food_id, quantity, printer_id } = item;

        if (!food_id || !quantity) {
          return res.status(400).json({
            success: false,
            message: "food_id va quantity kerak"
          });
        }

        const food = await Food.findById(food_id).populate("category");
        if (!food) {
          return res.status(404).json({
            success: false,
            message: `Taom topilmadi: ${food_id}`
          });
        }

        const category = food.category;
        const printer = await Printer.findById(printer_id || category.printer_id);

        updatedNewItems.push({
          food_id,
          name: food.name,
          price: food.price,
          quantity,
          category_name: category.title,
          printer_id: printer?._id,
          printer_ip: printer?.ip,
          printer_name: printer?.name,
        });

        // Total price'ga qo'shish
        updatedTotalPrice += food.price * quantity;
      }

      // Order'ga yangi items qo'shish
      order.items.push(...updatedNewItems);

      // ✅ PRINTER'LARGA YANGI TAOMLARNI YUBORISH
      const printerGroups = {};

      for (const item of updatedNewItems) {
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

      // Print'larni yuborish
      for (const [printerIp, group] of Object.entries(printerGroups)) {
        const payload = {
          items: group.items,
          table_number: order.table_number,
          waiter_name: order.waiter_name || "Nomalum",
          date: new Date().toLocaleString("uz-UZ"),
          type: "additional_order", // ✅ Qo'shimcha zakaz
          order_id: order._id.toString(),
          order_number: order.formatted_order_number,
          note: `${group.items.length} ta yangi taom qo'shildi`,
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
    }

    // ✅ 2. MAVJUD TAOMLAR MIQDORINI YANGILASH
    if (updated_items.length > 0) {
      console.log("🔄 Mavjud taomlar yangilanmoqda:", updated_items.length);

      for (const updatedItem of updated_items) {
        const { food_id, quantity } = updatedItem;
        
        const existingItemIndex = order.items.findIndex(
          item => item.food_id._id ? 
            item.food_id._id.toString() === food_id.toString() :
            item.food_id.toString() === food_id.toString()
        );

        if (existingItemIndex !== -1) {
          const oldQuantity = order.items[existingItemIndex].quantity;
          const itemPrice = order.items[existingItemIndex].price;
          const priceDifference = (quantity - oldQuantity) * itemPrice;
          
          // Miqdor va price'ni yangilash
          order.items[existingItemIndex].quantity = quantity;
          updatedTotalPrice += priceDifference;

          console.log(`🔄 ${order.items[existingItemIndex].name}: ${oldQuantity} → ${quantity} (${priceDifference > 0 ? '+' : ''}${priceDifference})`);
        }
      }
    }

    // ✅ 3. ORDER'NI SAQLASH
    order.total_price = updatedTotalPrice;
    order.markModified('items'); // Mongoose'ga items o'zgarganini bildirish
    await order.save();

    console.log("✅ Order muvaffaqiyatli yangilandi:", {
      order_number: order.formatted_order_number,
      new_items_added: new_items.length,
      items_updated: updated_items.length,
      old_total_price: order.total_price - (updatedTotalPrice - order.total_price),
      new_total_price: updatedTotalPrice,
      price_difference: updatedTotalPrice - (order.total_price - (updatedTotalPrice - order.total_price)),
      print_results: printResults.length
    });

    res.status(200).json({
      success: true,
      message: "Zakaz muvaffaqiyatli yangilandi",
      order: {
        id: order._id,
        order_number: order.formatted_order_number,
        status: order.status,
        total_price: updatedTotalPrice,
        items_count: order.items.length,
        new_items_added: new_items.length,
        items_updated: updated_items.length,
      },
      print_results: printResults,
      changes: {
        new_items_count: new_items.length,
        updated_items_count: updated_items.length,
        price_difference: updatedTotalPrice - (total_price || order.total_price),
        new_total: updatedTotalPrice,
      },
      debug: {
        total_printers: printResults.length,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("❌ Order update xatoligi:", error);
    res.status(500).json({
      success: false,
      message: "Zakaz yangilanishida xatolik",
      error: error.message,
      debug: {
        order_id: req.body.order_id,
        timestamp: new Date().toISOString(),
      },
    });
  }
};


// ✅ YANGI: Barcha faol zakazlarni olish (kassir uchun)
const getAllActiveOrders = async (req, res) => {
  try {
    console.log("🔍 Barcha faol zakazlar so'ralmoqda (kassir uchun)");

    // Barcha faol zakazlarni olish (hamma foydalanuvchilardan)
    const orders = await Order.find({
      status: { $in: ['pending', 'preparing', 'ready', 'served'] }, // Faol statuslar
      paidAt: { $exists: false } // To'lanmagan zakazlar
    })
    .populate('user_id', 'first_name last_name')
    .populate('table_id', 'name number')
    .sort({ createdAt: -1 })
    .limit(100);

    console.log("✅ Faol zakazlar topildi:", {
      count: orders.length,
      statuses: orders.map(o => o.status),
      tables: orders.map(o => o.table_number || o.table_id?.name)
    });

    const response = {
      success: true,
      orders: orders.map(order => ({
        _id: order._id,
        id: order._id,
        orderNumber: order.formatted_order_number,
        formatted_order_number: order.formatted_order_number,
        order_number: order.formatted_order_number,
        tableNumber: order.table_number || order.table_id?.name,
        table_number: order.table_number || order.table_id?.name,
        waiterName: order.user_id?.first_name || order.waiter_name,
        waiter_name: order.user_id?.first_name || order.waiter_name,
        first_name: order.user_id?.first_name || order.waiter_name,
        itemsCount: order.items?.length || 0,
        items: order.items,
        status: order.status,
        subtotal: order.total_price,
        total_price: order.total_price,
        finalTotal: order.final_total || order.total_price,
        final_total: order.final_total || order.total_price,
        createdAt: order.createdAt,
        created_at: order.createdAt,
        serviceAmount: order.service_amount || 0,
        service_amount: order.service_amount || 0,
        taxAmount: order.tax_amount || 0,
        tax_amount: order.tax_amount || 0,
      })),
      total_count: orders.length,
      filter: {
        status: "active_orders",
        description: "Barcha faol zakazlar (kassir ko'rishi uchun)"
      },
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Faol zakazlar response:", {
      orders_count: response.orders.length,
      first_order: response.orders[0] ? {
        orderNumber: response.orders[0].orderNumber,
        tableNumber: response.orders[0].tableNumber,
        waiterName: response.orders[0].waiterName,
        status: response.orders[0].status
      } : null
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Faol zakazlarni olishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Faol zakazlarni olishda xatolik",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};



// ✅ KASSIR UCHUN ZAKAZNI QAYTA OCHISH (yangi funksiya)
const reopenOrderForPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    console.log("🔄 Kassir zakaz qayta ochmoqda:", { orderId, userId });

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

    // Faqat "completed" statusdagi zakazlarni qayta ochish mumkin
    if (order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: `Faqat yopilgan zakazlarni qayta ochish mumkin. Hozirgi status: ${order.status}`,
        current_status: order.status,
      });
    }

    // Agar zakaz allaqachon to'langan bo'lsa
    if (order.paidAt || order.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Bu zakaz allaqachon to'langan",
        paid_at: order.paidAt,
      });
    }

    // Zakazni qayta ochish
    order.status = "pending_payment"; // Yangi status
    order.reopenedAt = new Date();
    order.reopenedBy = userId;
    order.kassirNotes = req.body.notes || `Kassir tomonidan qayta ochildi`;
    
    await order.save();

    console.log("✅ Zakaz kassir tomonidan qayta ochildi:", {
      order_id: order._id,
      order_number: order.formatted_order_number,
      old_status: "completed",
      new_status: order.status,
      kassir: userId,
    });

    const response = {
      success: true,
      message: "Zakaz qayta ochildi va to'lov uchun tayyor",
      order: {
        id: order._id,
        order_number: order.formatted_order_number,
        status: order.status,
        table_number: order.table_number,
        waiter_name: order.user_id?.first_name,
        completed_by: order.completedBy?.first_name,
        total_amount: order.final_total || order.total_price,
        completed_at: order.completedAt,
        reopened_at: order.reopenedAt,
        reopened_by: userId,
      },
      next_step: "Endi to'lov qabul qilish mumkin",
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Zakaz qayta ochishda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Zakaz qayta ochishda xatolik",
      error: err.message,
    });
  }
};

// ✅ KASSIR DASHBOARD UCHUN COMPLETED ORDERS (o'zgartirilgan)
const getCompletedOrdersForKassir = async (req, res) => {
  try {
    const { date, include_paid } = req.query;
    
    console.log("📋 Kassir completed orders request:", { date, include_paid });

    const targetDate = date || new Date().toISOString().split("T")[0];
    
    let query = {
      order_date: { $gte: targetDate, $lte: targetDate },
      status: { $in: ["completed"] }, // Faqat completed
    };

    // Agar kassir to'langan zakazlarni ham ko'rishni xohlasa
    if (include_paid === "true") {
      query.status.$in.push("paid", "pending_payment");
    }

    const orders = await Order.find(query)
      .populate("user_id", "first_name last_name")
      .populate("table_id", "name number")
      .populate("completedBy", "first_name last_name")
      .populate("paidBy", "first_name last_name")
      .populate("reopenedBy", "first_name last_name")
      .sort({ completedAt: -1, reopenedAt: -1 })
      .limit(100);

    console.log("✅ Kassir completed orders:", {
      count: orders.length,
      completed_count: orders.filter(o => o.status === "completed").length,
      paid_count: orders.filter(o => o.status === "paid").length,
      pending_payment_count: orders.filter(o => o.status === "pending_payment").length,
    });

    const response = {
      success: true,
      orders: orders.map((order) => ({
        _id: order._id,
        id: order._id,
        orderNumber: order.formatted_order_number,
        tableNumber: order.table_number,
        waiterName: order.user_id?.first_name || order.waiter_name,
        completedBy: order.completedBy?.first_name,
        itemsCount: order.items?.length || 0,
        subtotal: order.total_price,
        serviceAmount: order.service_amount || 0,
        taxAmount: order.tax_amount || 0,
        finalTotal: order.final_total || order.total_price,
        status: order.status,
        completedAt: order.completedAt,
        paidAt: order.paidAt,
        reopenedAt: order.reopenedAt, // ✅ Qayta ochilgan vaqt
        reopenedBy: order.reopenedBy?.first_name, // ✅ Kim qayta ochgan
        receiptPrinted: order.receiptPrinted || false,
        paymentMethod: order.paymentMethod,
        
        // To'lov ma'lumotlari
        cashAmount: order.paymentMethod === "mixed" ? 
          order.mixedPaymentDetails?.cashAmount || 0 : 
          (order.paymentMethod === "cash" ? order.paymentAmount || 0 : 0),
        cardAmount: order.paymentMethod === "mixed" ? 
          order.mixedPaymentDetails?.cardAmount || 0 : 
          (order.paymentMethod === "card" ? order.paymentAmount || 0 : 0),
        totalPayment: order.paymentMethod === "mixed" ? 
          order.mixedPaymentDetails?.totalAmount || 0 : 
          order.paymentAmount || order.final_total,
        changeAmount: order.changeAmount || 0,
        
        paidBy: order.paidBy?.first_name,
        kassirNotes: order.kassirNotes,
        
        // ✅ Kassir amallari
        canReopen: order.status === "completed" && !order.paidAt, // Qayta ochish mumkinmi
        canPayment: order.status === "pending_payment" || order.status === "completed", // To'lov qabul qilish mumkinmi
      })),
      total_count: orders.length,
      summary: {
        completed_orders: orders.filter(o => o.status === "completed").length,
        paid_orders: orders.filter(o => o.status === "paid").length,
        pending_payment_orders: orders.filter(o => o.status === "pending_payment").length,
        total_revenue: orders
          .filter(o => o.status === "paid")
          .reduce((sum, order) => sum + (order.final_total || order.total_price || 0), 0),
        pending_revenue: orders
          .filter(o => ["completed", "pending_payment"].includes(o.status))
          .reduce((sum, order) => sum + (order.final_total || order.total_price || 0), 0),
      },
      filter: {
        date: targetDate,
        include_paid: include_paid === "true",
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Kassir completed orders xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Kassir completed orders xatolik",
      error: err.message,
    });
  }
};

// ✅ PROCESSPAYMEMT FUNKSIYASINI O'ZGARTIRING
const processPaymentUpdated = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, paymentAmount, changeAmount, mixedPayment, notes } = req.body;
    const userId = req.user?.id;

    console.log("💰 To'lov qabul qilish (yangilangan):", {
      orderId, paymentMethod, paymentAmount, changeAmount, mixedPayment, notes, userId,
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

    // ✅ MUHIM O'ZGARISH: completed va pending_payment statuslarida to'lov qabul qilish mumkin
    if (!["completed", "pending_payment"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Faqat yopilgan yoki qayta ochildi zakaz'lar uchun to'lov qabul qilish mumkin",
        current_status: order.status,
      });
    }

    // Agar allaqachon to'langan bo'lsa
    if (order.paidAt) {
      return res.status(400).json({
        success: false,
        message: "Bu zakaz allaqachon to'langan",
        paid_at: order.paidAt,
      });
    }

    // To'lov validatsiyasi (oldingi kod bir xil)
    const validPaymentMethods = ["cash", "card", "transfer", "mixed"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri to'lov usuli",
        valid_methods: validPaymentMethods,
      });
    }

    // Mixed payment validation
    if (paymentMethod === "mixed") {
      if (!mixedPayment || !mixedPayment.cashAmount || !mixedPayment.cardAmount || !mixedPayment.totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Mixed payment uchun cashAmount, cardAmount va totalAmount kerak",
        });
      }

      const { cashAmount, cardAmount, totalAmount } = mixedPayment;
      if (cashAmount < 0 || cardAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi manfiy bo'lishi mumkin emas",
        });
      }

      if (totalAmount < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${totalAmount}`,
        });
      }
    } else {
      if (!paymentAmount || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "To'lov summasi noto'g'ri",
        });
      }

      if (paymentMethod === "cash" && paymentAmount < order.final_total) {
        return res.status(400).json({
          success: false,
          message: `To'lov summasi yetarli emas! Kerak: ${order.final_total}, Kiritildi: ${paymentAmount}`,
        });
      }
    }

    // To'lov ma'lumotlarini tayyorlash
    const paymentData = {
      paymentAmount,
      changeAmount,
    };

    if (paymentMethod === "mixed") {
      paymentData.mixedPayment = mixedPayment;
    }

    // To'lovni qayd qilish
    const result = await order.processPayment(
      userId, // paidBy
      paymentMethod, // paymentMethod
      notes, // notes
      paymentData // paymentData obyekti
    );

    console.log("✅ To'lov muvaffaqiyatli qayd qilindi (yangilangan):", {
      order_number: order.formatted_order_number,
      payment_method: paymentMethod,
      total: order.final_total,
      cash_amount: mixedPayment?.cashAmount || 0,
      card_amount: mixedPayment?.cardAmount || 0,
      change_amount: changeAmount || 0,
      kassir: userId,
      previous_status: order.status,
      new_status: "paid"
    });

    const response = {
      success: true,
      message: "To'lov muvaffaqiyatli qabul qilindi",
      order: {
        id: order._id,
        number: order.formatted_order_number,
        status: order.status, // Endi "paid" bo'ladi
        total: order.final_total,
        payment_method: paymentMethod,
        cash_amount: mixedPayment?.cashAmount || 0,
        card_amount: mixedPayment?.cardAmount || 0,
        total_payment: mixedPayment?.totalAmount || paymentAmount,
        change_amount: changeAmount || 0,
        paid_at: order.paidAt,
        receipt_printed: order.receiptPrinted,
      },
      payment: {
        method: paymentMethod,
        amount: order.final_total,
        cash_amount: mixedPayment?.cashAmount || 0,
        card_amount: mixedPayment?.cardAmount || 0,
        total_payment: mixedPayment?.totalAmount || paymentAmount,
        change_amount: changeAmount || 0,
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
    console.error("❌ To'lov qabul qilishda xatolik (yangilangan):", err);
    res.status(500).json({
      success: false,
      message: "To'lov qabul qilishda xatolik",
      error: err.message,
    });
  }
};






// ✅ EXPORT'larga qo'shing
module.exports = {
  createOrder,
  updateOrder, // ✅ Bu qatorni qo'shing
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
  getAllActiveOrders,
  reopenOrderForPayment, // ✅ YANGI
  getCompletedOrdersForKassir, // ✅ YANGI
  processPayment: processPaymentUpdated, // ✅ O'ZGARTIRILGAN
};