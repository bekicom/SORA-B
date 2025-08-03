const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    food_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    category_name: String,
    printer_id: mongoose.Schema.Types.ObjectId,
    printer_ip: String,
    printer_name: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    daily_order_number: { type: Number, index: true },
    order_date: { type: String, index: true },
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
    total_price: { type: Number, required: true },
    waiter_percentage: { type: Number, default: 0, min: 0, max: 100 },
    service_amount: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    final_total: { type: Number, default: 0 },
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "click", "transfer", "mixed"],
    },
    paymentAmount: { type: Number, default: 0 },
    changeAmount: { type: Number, default: 0 },
    mixedPaymentDetails: {
      cashAmount: { type: Number, default: 0 },
      cardAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      changeAmount: { type: Number, default: 0 },
      breakdown: {
        cash_percentage: { type: String, default: "0.0" },
        card_percentage: { type: String, default: "0.0" },
      },
      timestamp: { type: Date, default: Date.now },
    },
    receiptPrinted: { type: Boolean, default: false },
    receiptPrintedAt: Date,
    receiptPrintedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    kassirNotes: String,
    closedAt: Date,
    table_number: String,
    waiter_name: String,
  },
  { timestamps: true }
);

// Indexes
orderSchema.index({ order_date: 1, daily_order_number: 1 }, { unique: true });
orderSchema.index({ status: 1, completedAt: 1 });
orderSchema.index({ paymentMethod: 1, paidAt: 1 });

// Pre-save middleware
orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.daily_order_number) {
    const today = new Date().toISOString().split("T")[0];
    this.order_date = today;
    const lastOrder = await this.constructor
      .findOne({ order_date: today })
      .sort({ daily_order_number: -1 });
    this.daily_order_number = lastOrder ? lastOrder.daily_order_number + 1 : 1;
  }

  if (this.isModified("status")) {
    const now = new Date();
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = now;
      this.closedAt = now;
    }
    if (this.status === "paid" && !this.paidAt) this.paidAt = now;
  }

  // Mixed payment validation
  if (this.paymentMethod === "mixed" && this.mixedPaymentDetails) {
    const { cashAmount, cardAmount, totalAmount } = this.mixedPaymentDetails;
    if (cashAmount < 0 || cardAmount < 0)
      return next(
        new Error("Naqd yoki karta summasi manfiy bo'lishi mumkin emas")
      );
    if (Math.abs(totalAmount - (cashAmount + cardAmount)) > 0.01) {
      return next(
        new Error(
          "Naqd va karta summalari jami totalAmount ga teng bo'lishi kerak"
        )
      );
    }
    this.paymentAmount = totalAmount;
    this.mixedPaymentDetails.breakdown.cash_percentage = (
      (cashAmount / totalAmount) *
      100
    ).toFixed(1);
    this.mixedPaymentDetails.breakdown.card_percentage = (
      (cardAmount / totalAmount) *
      100
    ).toFixed(1);
  }
  next();
});

// Virtual
orderSchema.virtual("formatted_order_number").get(function () {
  return this.daily_order_number
    ? `#${String(this.daily_order_number).padStart(3, "0")}`
    : `#${this._id.toString().slice(-6)}`;
});

// Static methods
orderSchema.statics.getPendingPayments = async function () {
  return await this.find({ status: "completed" })
    .populate("user_id", "first_name last_name")
    .populate("table_id", "name number")
    .sort({ completedAt: 1 });
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
        totalRevenue: { $sum: "$final_total" },
        cashOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0] },
        },
        cardOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "card"] }, 1, 0] },
        },
        clickOrders: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "click"] }, 1, 0] },
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
  return (
    result[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      cashOrders: 0,
      cardOrders: 0,
      clickOrders: 0,
      transferOrders: 0,
      mixedOrders: 0,
    }
  );
};

// ✅ YANGILANGAN processPayment method
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
  });

  // ✅ Status validation
  if (!["completed", "pending_payment"].includes(this.status)) {
    throw new Error(
      "Faqat yopilgan yoki qayta ochildi zakaz'lar uchun to'lov qabul qilinadi"
    );
  }

  // ✅ Payment method validation with debugging
  const validMethods = ["cash", "card", "click", "transfer", "mixed"];
  if (!validMethods.includes(paymentMethod)) {
    console.error("❌ Invalid payment method:", paymentMethod);
    console.error("Valid methods:", validMethods);
    console.error("Type of paymentMethod:", typeof paymentMethod);
    throw new Error(
      `Noto'g'ri to'lov usuli: ${paymentMethod}. Valid methods: ${validMethods.join(
        ", "
      )}`
    );
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
        cash_percentage: (
          (Number(cashAmount) / Number(totalAmount)) *
          100
        ).toFixed(1),
        card_percentage: (
          (Number(cardAmount) / Number(totalAmount)) *
          100
        ).toFixed(1),
      },
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
    // ✅ ODDIY TO'LOV (CASH, CARD, CLICK, TRANSFER)
    let amount = 0;
    let change = 0;

    // Controller'dan kelayotgan ma'lumotlarni to'g'ri olish
    if (
      paymentData.paymentAmount !== undefined &&
      paymentData.paymentAmount !== null
    ) {
      amount = Number(paymentData.paymentAmount);
    } else if (
      paymentData.amount !== undefined &&
      paymentData.amount !== null
    ) {
      amount = Number(paymentData.amount);
    } else {
      amount = Number(paymentData) || 0;
    }

    if (
      paymentData.changeAmount !== undefined &&
      paymentData.changeAmount !== null
    ) {
      change = Number(paymentData.changeAmount);
    } else if (
      paymentData.change !== undefined &&
      paymentData.change !== null
    ) {
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
        paymentMethod,
      });
      throw new Error(`To'lov summasi noto'g'ri: ${amount} (${typeof amount})`);
    }

    // ✅ TO'LOV USULLARIGA QO'RA VALIDATION
    if (paymentMethod === "cash") {
      // Cash uchun amount >= final_total bo'lishi kerak
      if (amount < this.final_total) {
        throw new Error(
          `Naqd to'lov summasi yetarli emas! Kerak: ${this.final_total}, Kiritildi: ${amount}`
        );
      }
      this.paymentAmount = amount;
      this.changeAmount = isNaN(change) ? 0 : change;

      console.log(
        `✅ Cash payment: amount=${amount}, change=${this.changeAmount}`
      );
    } else if (["card", "click", "transfer"].includes(paymentMethod)) {
      // Card, Click, Transfer uchun exact amount bo'lishi kerak
      this.paymentAmount = this.final_total;
      this.changeAmount = 0;

      console.log(
        `✅ ${paymentMethod} payment: exact amount set to ${this.final_total}`
      );
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
      finalTotal: this.final_total,
    });
    throw new Error(
      `Final validation: To'lov summasi noto'g'ri - ${this.paymentAmount}`
    );
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

orderSchema.set("toJSON", { virtuals: true });
module.exports = mongoose.model("Order", orderSchema);
