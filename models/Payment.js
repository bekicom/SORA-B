const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    payment_method: {
      type: String,
      enum: ["cash", "card", "click", "transfer", "mixed"],
      required: true,
    },

    payment_amount: {
      type: Number,
      required: true,
      min: 0,
    },

    change_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Aralash to'lov uchun
    mixed_payment_details: {
      cash_amount: { type: Number, default: 0 },
      card_amount: { type: Number, default: 0 },
      total_amount: { type: Number, default: 0 },
    },

    // Order ma'lumotlari (cache uchun)
    order_total: {
      type: Number,
      required: true,
    },

    table_number: {
      type: String,
      required: true,
    },

    waiter_name: String,

    // Kim to'lov qabul qildi
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    processed_by_name: String,
    notes: String,

    // Sana va vaqt
    payment_date: {
      type: String,
      default: () => new Date().toISOString().split("T")[0], // YYYY-MM-DD
    },

    status: {
      type: String,
      enum: ["completed", "refunded"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

// ===== INDEXES =====
paymentSchema.index({ payment_date: 1 });
paymentSchema.index({ processed_by: 1 });
paymentSchema.index({ payment_method: 1 });
paymentSchema.index({ order_id: 1 });

// ===== STATIC METHODS =====

// Kunlik statistika
paymentSchema.statics.getDailyStats = async function (date) {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const stats = await this.aggregate([
    {
      $match: {
        payment_date: targetDate,
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$payment_method",
        count: { $sum: 1 },
        total_amount: { $sum: "$payment_amount" },
      },
    },
  ]);

  const summary = await this.aggregate([
    {
      $match: {
        payment_date: targetDate,
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        total_payments: { $sum: 1 },
        total_amount: { $sum: "$payment_amount" },
      },
    },
  ]);

  return {
    by_method: stats,
    summary: summary[0] || {
      total_payments: 0,
      total_amount: 0,
    },
    date: targetDate,
  };
};

module.exports = mongoose.model("Payment", paymentSchema);
