const Payment = require("../models/Payment");
const Order = require("../models/Order");
const User = require("../models/User");

// ✅ TO'LOVNI BAZAGA SAQLASH
const savePaymentToDatabase = async (order, paymentData, userId, userName) => {
  try {
    const paymentRecord = new Payment({
      order_id: order._id,
      payment_method: paymentData.paymentMethod,
      payment_amount: paymentData.paymentAmount,
      change_amount: paymentData.changeAmount || 0,
      mixed_payment_details: paymentData.mixedPayment || null,
      order_total: order.final_total,
      table_number: order.table_number || order.table_id?.name || "Unknown",
      waiter_name: order.waiter_name || order.user_id?.first_name,
      processed_by: userId,
      processed_by_name: userName,
      notes: paymentData.notes,
    });

    await paymentRecord.save();
    console.log("✅ To'lov bazaga saqlandi:", paymentRecord._id);
    return paymentRecord;
  } catch (error) {
    console.error("❌ To'lovni bazaga saqlashda xatolik:", error);
    throw error;
  }
};

// ✅ BARCHA TO'LOVLARNI OLISH
const getAllPayments = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      paymentMethod,
      kasssirId,
      page = 1,
      limit = 50,
    } = req.query;

    let query = { status: "completed" };

    // Sana filtri
    if (date) {
      query.payment_date = date;
    } else if (startDate && endDate) {
      query.payment_date = { $gte: startDate, $lte: endDate };
    }

    // To'lov usuli filtri
    if (paymentMethod && paymentMethod !== "all") {
      query.payment_method = paymentMethod;
    }

    // Kassir filtri
    if (kasssirId && kasssirId !== "all") {
      query.processed_by = kasssirId;
    }

    const skip = (page - 1) * limit;

    const [payments, totalCount] = await Promise.all([
      Payment.find(query)
        .populate("order_id", "formatted_order_number daily_order_number")
        .populate("processed_by", "first_name last_name")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(query),
    ]);

    const totalAmount = await Payment.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$payment_amount" } } },
    ]);

    res.status(200).json({
      success: true,
      payments: payments.map((payment) => ({
        id: payment._id,
        order_number: payment.order_id?.formatted_order_number,
        table_number: payment.table_number,
        waiter_name: payment.waiter_name,
        payment_method: payment.payment_method,
        payment_amount: payment.payment_amount,
        change_amount: payment.change_amount,
        order_total: payment.order_total,
        processed_by:
          payment.processed_by_name || payment.processed_by?.first_name,
        notes: payment.notes,
        created_at: payment.created_at,
        payment_date: payment.payment_date,
        mixed_details: payment.mixed_payment_details,
      })),
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalCount / limit),
        total_count: totalCount,
        per_page: parseInt(limit),
      },
      totals: {
        total_amount: totalAmount[0]?.total || 0,
        count: totalCount,
      },
      filters: {
        date,
        startDate,
        endDate,
        paymentMethod,
        kasssirId,
      },
    });
  } catch (error) {
    console.error("❌ To'lovlarni olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "To'lovlarni olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ KUNLIK TO'LOVLAR STATISTIKASI
const getDailyPaymentStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const stats = await Payment.getDailyStats(targetDate);

    res.status(200).json({
      success: true,
      date: targetDate,
      stats,
      payment_methods: {
        cash: "Naqd to'lov",
        card: "Bank kartasi",
        click: "Click to'lov",
        transfer: "Bank o'tkazmasi",
        mixed: "Aralash to'lov",
      },
    });
  } catch (error) {
    console.error("❌ Kunlik statistika xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Statistika olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ KASSIR STATISTIKASI
const getKassirPaymentStats = async (req, res) => {
  try {
    const { kasssirId, startDate, endDate } = req.query;
    const userId = kasssirId || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Kassir ID kerak",
      });
    }

    let query = {
      processed_by: userId,
      status: "completed",
    };

    if (startDate && endDate) {
      query.payment_date = { $gte: startDate, $lte: endDate };
    }

    const stats = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$payment_method",
          count: { $sum: 1 },
          total_amount: { $sum: "$payment_amount" },
        },
      },
    ]);

    const userInfo = await User.findById(userId, "first_name last_name");

    res.status(200).json({
      success: true,
      kassir: {
        id: userId,
        name: userInfo
          ? `${userInfo.first_name} ${userInfo.last_name}`
          : "Unknown",
      },
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      stats,
    });
  } catch (error) {
    console.error("❌ Kassir statistika xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Kassir statistika xatolik",
      error: error.message,
    });
  }
};

// ✅ BITTA TO'LOVNI OLISH
const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate("order_id")
      .populate("processed_by", "first_name last_name");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "To'lov topilmadi",
      });
    }

    res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        order: payment.order_id,
        payment_method: payment.payment_method,
        payment_amount: payment.payment_amount,
        change_amount: payment.change_amount,
        order_total: payment.order_total,
        table_number: payment.table_number,
        waiter_name: payment.waiter_name,
        processed_by: payment.processed_by,
        notes: payment.notes,
        mixed_details: payment.mixed_payment_details,
        created_at: payment.created_at,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("❌ To'lovni olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "To'lovni olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ TO'LOV USULLARI BO'YICHA STATISTIKA
const getPaymentMethodStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = { status: "completed" };

    if (startDate && endDate) {
      query.payment_date = { $gte: startDate, $lte: endDate };
    } else {
      // Bugun
      const today = new Date().toISOString().split("T")[0];
      query.payment_date = today;
    }

    const stats = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$payment_method",
          count: { $sum: 1 },
          total_amount: { $sum: "$payment_amount" },
          avg_amount: { $avg: "$payment_amount" },
        },
      },
      { $sort: { total_amount: -1 } },
    ]);

    // Mixed payment breakdown
    const mixedPayments = await Payment.find({
      ...query,
      payment_method: "mixed",
    }).select("mixed_payment_details");

    let totalCashFromMixed = 0;
    let totalCardFromMixed = 0;

    mixedPayments.forEach((payment) => {
      if (payment.mixed_payment_details) {
        totalCashFromMixed += payment.mixed_payment_details.cash_amount || 0;
        totalCardFromMixed += payment.mixed_payment_details.card_amount || 0;
      }
    });

    res.status(200).json({
      success: true,
      period: { startDate, endDate },
      stats,
      mixed_breakdown: {
        total_mixed_orders: mixedPayments.length,
        total_cash_from_mixed: totalCashFromMixed,
        total_card_from_mixed: totalCardFromMixed,
      },
    });
  } catch (error) {
    console.error("❌ To'lov usullari statistika xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Statistika olishda xatolik",
      error: error.message,
    });
  }
};

module.exports = {
  savePaymentToDatabase,
  getAllPayments,
  getDailyPaymentStats,
  getKassirPaymentStats,
  getPaymentById,
  getPaymentMethodStats,
};
