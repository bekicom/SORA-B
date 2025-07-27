const mongoose = require("mongoose");

// Avval item schema yaratiladi
const orderItemSchema = new mongoose.Schema(
  {
    food_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    category_name: String,
    printer_id: mongoose.Schema.Types.ObjectId,
    printer_ip: String,
    printer_name: String,
  },
  { _id: false }
);

// Order schema (Kassir workflow + Mixed payment bilan yangilangan)
const orderSchema = new mongoose.Schema(
  {
    daily_order_number: {
      type: Number,
      index: true,
    },
    order_date: {
      type: String, // "2025-07-15" format
      index: true,
    },
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: [
        "pending",
        "preparing",
        "ready",
        "served",
        "completed",
        "paid",
        "cancelled",
      ],
      default: "pending",
    },
    total_price: {
      type: Number,
      required: true,
    },
    service_amount: {
      type: Number,
      default: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
    },
    final_total: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paidAt: {
      type: Date,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer", "mixed"],
    },
    paymentAmount: {
      type: Number,
      default: 0,
    },
    changeAmount: {
      type: Number,
      default: 0,
    },
    mixedPaymentDetails: {
      cashAmount: {
        type: Number,
        default: 0,
      },
      cardAmount: {
        type: Number,
        default: 0,
      },
      totalAmount: {
        type: Number,
        default: 0,
      },
      changeAmount: {
        type: Number,
        default: 0,
      },
      breakdown: {
        cash_percentage: {
          type: String,
          default: "0.0",
        },
        card_percentage: {
          type: String,
          default: "0.0",
        },
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
    receiptPrinted: {
      type: Boolean,
      default: false,
    },
    receiptPrintedAt: {
      type: Date,
    },
    receiptPrintedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    kassirNotes: {
      type: String,
    },
    closedAt: {
      type: Date,
    },
    table_number: String,
    waiter_name: String,
    kitchen_print_template: {
      type: String,
      default: "",
    },
    printer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Printer",
    },
  },
  { timestamps: true }
);

// Compound indexes
orderSchema.index({ order_date: 1, daily_order_number: 1 }, { unique: true });
orderSchema.index({ status: 1, completedAt: 1 });
orderSchema.index({ status: 1, paidAt: 1 });
orderSchema.index({ paymentMethod: 1, paidAt: 1 });
orderSchema.statics.getAllActiveOrders = async function () {
  return await this.find({
    status: { $in: ["pending", "preparing", "ready", "served"] }, // Faol zakazlar
    paidAt: { $exists: false }, // To'lanmagan zakazlar
  })
    .populate("user_id", "first_name last_name")
    .populate("table_id", "name number")
    .sort({ createdAt: -1 });
};
// Pre-save middleware
orderSchema.pre("save", async function (next) {
  // Daily order number generation
  if (this.isNew && !this.daily_order_number) {
    try {
      const today = new Date().toISOString().split("T")[0];
      this.order_date = today;

      const lastOrder = await this.constructor
        .findOne({ order_date: today })
        .sort({ daily_order_number: -1 })
        .select("daily_order_number");

      this.daily_order_number = lastOrder
        ? lastOrder.daily_order_number + 1
        : 1;

      console.log(
        `🆕 Yangi zakaz nomeri: #${this.daily_order_number} (${today})`
      );
    } catch (error) {
      console.error("❌ Daily order number generate xatoligi:", error);
      this.order_date = new Date().toISOString().split("T")[0];
      this.daily_order_number = Date.now() % 1000;
    }
  }

  // Status change logic
  if (this.isModified("status")) {
    const now = new Date();

    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = now;
      this.closedAt = now;
      console.log(`📋 Order completed: ${this.formatted_order_number}`);
    }

    if (this.status === "paid" && !this.paidAt) {
      this.paidAt = now;
      console.log(`💰 Payment received: ${this.formatted_order_number}`);
    }
  }

  // Mixed payment validation
  if (this.paymentMethod === "mixed" && this.mixedPaymentDetails) {
    const { cashAmount, cardAmount, totalAmount, changeAmount } =
      this.mixedPaymentDetails;

    // Validate amounts
    if (cashAmount < 0 || cardAmount < 0) {
      return next(
        new Error("Naqd yoki karta summasi manfiy bo'lishi mumkin emas")
      );
    }

    if (!totalAmount || totalAmount <= 0) {
      return next(new Error("TotalAmount noto'g'ri"));
    }

    if (Math.abs(totalAmount - (cashAmount + cardAmount)) > 0.01) {
      return next(
        new Error(
          `Naqd va karta summalari jami totalAmount ga teng bo'lishi kerak! Cash: ${cashAmount}, Card: ${cardAmount}, Total: ${totalAmount}`
        )
      );
    }

    if (totalAmount < this.final_total) {
      return next(
        new Error(
          `To'lov summasi yetarli emas! Kerak: ${this.final_total}, Kiritildi: ${totalAmount}`
        )
      );
    }

    // Calculate percentages
    if (totalAmount > 0) {
      this.mixedPaymentDetails.breakdown.cash_percentage = (
        (cashAmount / totalAmount) *
        100
      ).toFixed(1);
      this.mixedPaymentDetails.breakdown.card_percentage = (
        (cardAmount / totalAmount) *
        100
      ).toFixed(1);
    }

    // Update main payment fields
    this.paymentAmount = totalAmount;
    this.changeAmount = changeAmount || 0;

    console.log(`🔄 Mixed payment processed: ${this.formatted_order_number}`, {
      cash: cashAmount,
      card: cardAmount,
      total: totalAmount,
      change: changeAmount,
    });
  }

  next();
});

// Virtual: Formatted order number
orderSchema.virtual("formatted_order_number").get(function () {
  if (!this.daily_order_number) return `#${this._id.toString().slice(-6)}`;
  return `#${String(this.daily_order_number).padStart(3, "0")}`;
});

// STATIC METHODS
orderSchema.statics.getTodayOrdersCount = async function () {
  const today = new Date().toISOString().split("T")[0];
  return await this.countDocuments({ order_date: today });
};

orderSchema.statics.getNextOrderNumber = async function () {
  const today = new Date().toISOString().split("T")[0];
  const lastOrder = await this.findOne({ order_date: today })
    .sort({ daily_order_number: -1 })
    .select("daily_order_number");

  return lastOrder ? lastOrder.daily_order_number + 1 : 1;
};

orderSchema.statics.getCompletedOrders = async function (options = {}) {
  const {
    startDate = new Date().toISOString().split("T")[0],
    endDate = new Date().toISOString().split("T")[0],
    limit = 50,
    paid = false,
  } = options;

  const query = {
    order_date: { $gte: startDate, $lte: endDate },
    status: paid ? "paid" : "completed",
  };

  return await this.find(query)
    .populate("user_id", "first_name last_name")
    .populate("table_id", "name number")
    .populate("completedBy", "first_name last_name")
    .populate("paidBy", "first_name last_name")
    .sort({ completedAt: -1 })
    .limit(limit);
};

orderSchema.statics.getPendingPayments = async function () {
  return await this.find({ status: "completed" })
    .populate("user_id", "first_name last_name")
    .populate("table_id", "name number")
    .populate("completedBy", "first_name last_name")
    .sort({ completedAt: 1 });
};

orderSchema.statics.getPaymentAnalytics = async function (date) {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const result = await this.aggregate([
    {
      $match: {
        order_date: targetDate,
        status: "paid",
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$paymentAmount" },
        avgAmount: { $avg: "$paymentAmount" },
      },
    },
  ]);

  const mixedPayments = await this.find({
    order_date: targetDate,
    status: "paid",
    paymentMethod: "mixed",
  }).select("mixedPaymentDetails");

  let totalCashFromMixed = 0;
  let totalCardFromMixed = 0;

  mixedPayments.forEach((order) => {
    if (order.mixedPaymentDetails) {
      totalCashFromMixed += order.mixedPaymentDetails.cashAmount || 0;
      totalCardFromMixed += order.mixedPaymentDetails.cardAmount || 0;
    }
  });

  return {
    paymentMethods: result,
    mixedPaymentBreakdown: {
      totalMixedOrders: mixedPayments.length,
      totalCashFromMixed,
      totalCardFromMixed,
      totalMixedAmount: totalCashFromMixed + totalCardFromMixed,
      avgCashPerMixed: mixedPayments.length
        ? totalCashFromMixed / mixedPayments.length
        : 0,
      avgCardPerMixed: mixedPayments.length
        ? totalCardFromMixed / mixedPayments.length
        : 0,
    },
  };
};

orderSchema.statics.getDailySalesSummary = async function (date) {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const result = await this.aggregate([
    {
      $match: {
        order_date: targetDate,
        status: { $in: ["completed", "paid"] },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        paidOrders: {
          $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
        },
        totalRevenue: { $sum: "$final_total" },
        totalServiceAmount: { $sum: "$service_amount" },
        totalTaxAmount: { $sum: "$tax_amount" },
        avgOrderValue: { $avg: "$final_total" },
        cashOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0] },
        },
        cardOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "card"] }, 1, 0] },
        },
        transferOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "transfer"] }, 1, 0] },
        },
        mixedOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "mixed"] }, 1, 0] },
        },
      },
    },
  ]);

  const mixedPayments = await this.find({
    order_date: targetDate,
    status: "paid",
    paymentMethod: "mixed",
  }).select("mixedPaymentDetails");

  let totalCashFromMixed = 0;
  let totalCardFromMixed = 0;

  mixedPayments.forEach((order) => {
    if (order.mixedPaymentDetails) {
      totalCashFromMixed += order.mixedPaymentDetails.cashAmount || 0;
      totalCardFromMixed += order.mixedPaymentDetails.cardAmount || 0;
    }
  });

  return {
    ...(result[0] || {
      totalOrders: 0,
      completedOrders: 0,
      paidOrders: 0,
      totalRevenue: 0,
      totalServiceAmount: 0,
      totalTaxAmount: 0,
      avgOrderValue: 0,
      cashOrders: 0,
      cardOrders: 0,
      transferOrders: 0,
      mixedOrders: 0,
    }),
    mixedPaymentBreakdown: {
      totalMixedOrders: mixedPayments.length,
      totalCashFromMixed,
      totalCardFromMixed,
      totalMixedAmount: totalCashFromMixed + totalCardFromMixed,
    },
  };
};

// INSTANCE METHODS
orderSchema.methods.getOrderDisplayInfo = function () {
  return {
    id: this._id,
    number: this.formatted_order_number,
    daily_number: this.daily_order_number,
    date: this.order_date,
    status: this.status,
    total: this.final_total || this.total_price,
    table: this.table_number,
    waiter: this.waiter_name,
    created: this.createdAt,
    completed: this.completedAt,
    paid: this.paidAt,
    paymentMethod: this.paymentMethod,
    paymentAmount: this.paymentAmount,
    changeAmount: this.changeAmount,
    mixedPaymentDetails: this.mixedPaymentDetails,
    receiptPrinted: this.receiptPrinted,
  };
};

orderSchema.methods.completeOrder = async function (completedBy) {
  this.status = "completed";
  this.completedAt = new Date();
  this.completedBy = completedBy;
  this.closedAt = this.completedAt;
  return await this.save();
};

// ✅ Faqat shu metodini almashtiring (424-525 qator atrofida):

orderSchema.methods.processPayment = async function (
  paidBy,
  paymentMethod,
  notes,
  paymentData = {}
) {
  console.log("🔍 processPayment called with:", {
    paidBy,
    paymentMethod,
    notes,
    paymentData,
    orderFinalTotal: this.final_total,
    orderNumber: this.formatted_order_number,
    paymentDataKeys: Object.keys(paymentData), // ✅ Qanday keylar borligini ko'rish
  });

  if (!["completed", "pending_payment"].includes(this.status)) {
    throw new Error("Faqat yopilgan yoki qayta ochildi zakaz'lar uchun to'lov qabul qilinadi");
  }

  if (!["cash", "card", "transfer", "mixed"].includes(paymentMethod)) {
    throw new Error("Noto'g'ri to'lov usuli");
  }

  this.status = "paid";
  this.paidAt = new Date();
  this.paidBy = paidBy;
  this.paymentMethod = paymentMethod;
  if (notes) this.kassirNotes = notes;

  if (paymentMethod === "mixed") {
    if (!paymentData.mixedPayment) {
      throw new Error("Mixed payment ma'lumotlari talab qilinadi");
    }

    const { cashAmount, cardAmount, totalAmount, changeAmount } =
      paymentData.mixedPayment;

    console.log("🔍 Mixed payment validation:", {
      cashAmount,
      cardAmount,
      totalAmount,
      changeAmount,
      orderFinalTotal: this.final_total,
    });

    // Mixed payment validation
    if (cashAmount < 0 || cardAmount < 0) {
      throw new Error("Naqd yoki karta summasi manfiy bo'lishi mumkin emas");
    }

    if (!totalAmount || totalAmount <= 0) {
      throw new Error("Mixed payment: TotalAmount noto'g'ri");
    }

    if (Math.abs(totalAmount - (cashAmount + cardAmount)) > 0.01) {
      throw new Error(
        `Naqd va karta summalari jami totalAmount ga teng bo'lishi kerak! Cash: ${cashAmount}, Card: ${cardAmount}, Total: ${totalAmount}`
      );
    }

    if (totalAmount < this.final_total) {
      throw new Error(
        `Mixed payment: To'lov summasi yetarli emas! Kerak: ${this.final_total}, Kiritildi: ${totalAmount}`
      );
    }

    this.mixedPaymentDetails = {
      cashAmount: Number(cashAmount),
      cardAmount: Number(cardAmount),
      totalAmount: Number(totalAmount),
      changeAmount: Number(changeAmount) || 0,
      timestamp: new Date(),
      breakdown: {
        cash_percentage: ((Number(cashAmount) / Number(totalAmount)) * 100).toFixed(1),
        card_percentage: ((Number(cardAmount) / Number(totalAmount)) * 100).toFixed(1),
      }
    };
    this.paymentAmount = Number(totalAmount);
    this.changeAmount = Number(changeAmount) || 0;

    console.log("✅ Mixed payment processed:", {
      cash: this.mixedPaymentDetails.cashAmount,
      card: this.mixedPaymentDetails.cardAmount,
      total: this.paymentAmount,
      change: this.changeAmount,
    });
  } else {
    // ✅ ASOSIY TUZATISH SHU YERDA!
    // paymentData obyektidan to'g'ri olish
    let amount = 0;
    let change = 0;

    // Controller'dan kelayotgan ma'lumotlarni to'g'ri olish
    if (paymentData.paymentAmount !== undefined && paymentData.paymentAmount !== null) {
      amount = Number(paymentData.paymentAmount);
    } else if (paymentData.amount !== undefined && paymentData.amount !== null) {
      amount = Number(paymentData.amount);
    } else {
      // Agar paymentData ichida yo'q bo'lsa, to'g'ridan-to'g'ri paymentData o'zi bo'lishi mumkin
      amount = Number(paymentData) || 0;
    }

    if (paymentData.changeAmount !== undefined && paymentData.changeAmount !== null) {
      change = Number(paymentData.changeAmount);
    } else if (paymentData.change !== undefined && paymentData.change !== null) {
      change = Number(paymentData.change);
    }

    console.log("🔍 Single payment processing:", {
      originalPaymentData: paymentData,
      extractedAmount: amount,
      extractedChange: change,
      orderFinalTotal: this.final_total,
      paymentMethod,
      amountType: typeof amount,
      isAmountNumber: !isNaN(amount),
    });

    // ✅ Validation
    if (isNaN(amount) || amount <= 0) {
      console.error("❌ Invalid payment amount:", {
        amount,
        isNaN: isNaN(amount),
        paymentData,
        paymentMethod
      });
      throw new Error(`To'lov summasi noto'g'ri: ${amount} (${typeof amount})`);
    }

    // Cash uchun amount >= final_total bo'lishi kerak
    if (paymentMethod === "cash" && amount < this.final_total) {
      throw new Error(
        `Naqd to'lov summasi yetarli emas! Kerak: ${this.final_total}, Kiritildi: ${amount}`
      );
    }

    // Card/Transfer uchun exact amount bo'lishi kerak
    if (["card", "transfer"].includes(paymentMethod)) {
      // Card to'lovda exact amount o'rnatish
      this.paymentAmount = this.final_total;
      this.changeAmount = 0;
      
      console.log(`✅ ${paymentMethod} payment: exact amount set to ${this.final_total}`);
    } else {
      // Cash to'lovda
      this.paymentAmount = amount;
      this.changeAmount = isNaN(change) ? 0 : change;
      
      console.log(`✅ Cash payment: amount=${amount}, change=${this.changeAmount}`);
    }

    this.mixedPaymentDetails = null; // Oddiy to'lovda mixedPaymentDetails tozalanadi

    console.log("✅ Single payment final values:", {
      method: paymentMethod,
      paymentAmount: this.paymentAmount,
      changeAmount: this.changeAmount,
      finalTotal: this.final_total,
    });
  }

  // ✅ Final validation before save
  if (!this.paymentAmount || this.paymentAmount <= 0) {
    console.error("❌ Final validation failed:", {
      paymentAmount: this.paymentAmount,
      paymentMethod,
      paymentData,
      finalTotal: this.final_total
    });
    throw new Error(`Final validation: To'lov summasi noto'g'ri - ${this.paymentAmount}`);
  }

  console.log("💾 Saving order with payment data:", {
    orderNumber: this.formatted_order_number,
    status: this.status,
    paymentMethod: this.paymentMethod,
    paymentAmount: this.paymentAmount,
    changeAmount: this.changeAmount,
    finalTotal: this.final_total,
  });

  return await this.save();
};
orderSchema.methods.markReceiptPrinted = async function (printedBy) {
  this.receiptPrinted = true;
  this.receiptPrintedAt = new Date();
  this.receiptPrintedBy = printedBy;
  return await this.save();
};

orderSchema.methods.getKassirSummary = function () {
  const summary = {
    orderNumber: this.formatted_order_number,
    tableNumber: this.table_number,
    waiterName: this.waiter_name,
    itemsCount: this.items.length,
    subtotal: this.total_price,
    serviceAmount: this.service_amount,
    taxAmount: this.tax_amount,
    finalTotal: this.final_total,
    completedAt: this.completedAt,
    paidAt: this.paidAt,
    status: this.status,
    receiptPrinted: this.receiptPrinted,
    paymentMethod: this.paymentMethod,
    paymentAmount: this.paymentAmount,
    changeAmount: this.changeAmount,
    kassirNotes: this.kassirNotes,
  };

  if (this.paymentMethod === "mixed" && this.mixedPaymentDetails) {
    summary.mixedPaymentDetails = this.mixedPaymentDetails;
  }

  return summary;
};

orderSchema.methods.getPaymentSummary = function () {
  if (this.paymentMethod === "mixed" && this.mixedPaymentDetails) {
    return {
      method: "mixed",
      totalAmount: this.paymentAmount,
      changeAmount: this.changeAmount,
      breakdown: {
        cash: this.mixedPaymentDetails.cashAmount,
        card: this.mixedPaymentDetails.cardAmount,
        cash_percentage: this.mixedPaymentDetails.breakdown.cash_percentage,
        card_percentage: this.mixedPaymentDetails.breakdown.card_percentage,
      },
    };
  }

  return {
    method: this.paymentMethod,
    totalAmount: this.paymentAmount,
    changeAmount: this.changeAmount,
  };
};

// Virtual fields ni JSON ga qo'shish
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
