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
    // Qo'shimcha ma'lumotlar
    category_name: String,
    printer_id: mongoose.Schema.Types.ObjectId,
    printer_ip: String,
    printer_name: String,
  },
  { _id: false }
);

// So'ng order schema (✅ KASSIR WORKFLOW bilan yangilangan)
const orderSchema = new mongoose.Schema(
  {
    // Daily order number system
    daily_order_number: {
      type: Number,
      index: true,
    },
    order_date: {
      type: String, // "2025-07-15" format
      index: true,
    },

    // Basic order info
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

    // ✅ UPDATED STATUS ENUM - Kassir workflow uchun
    status: {
      type: String,
      enum: [
        "pending", // Yangi zakaz
        "preparing", // Tayyorlanmoqda
        "ready", // Tayyor
        "served", // Xizmat ko'rsatildi
        "completed", // ✅ Ofitsiant yopdi (kassir uchun)
        "paid", // ✅ Kassir to'lov qabul qildi
        "cancelled", // ✅ Bekor qilingan
      ],
      default: "pending",
    },

    total_price: {
      type: Number,
      required: true,
    },

    // Financial calculations
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

    // ✅ KASSIR WORKFLOW FIELDS
    completedAt: {
      type: Date,
      // Ofitsiant zakaz yopganda
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Qaysi ofitsiant yopgani
    },

    paidAt: {
      type: Date,
      // Kassir to'lov qabul qilganda
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Qaysi kassir to'lov qabul qilgani
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer", "mixed"],
      // To'lov usuli
    },

    receiptPrinted: {
      type: Boolean,
      default: false,
      // Chek chiqarilganmi
    },

    receiptPrintedAt: {
      type: Date,
      // Chek qachon chiqarilgan
    },

    receiptPrintedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Kim chek chiqargan
    },

    // ✅ KASSIR NOTES
    kassirNotes: {
      type: String,
      // Kassir izohlari
    },

    // Backward compatibility
    closedAt: {
      type: Date,
      // Eski field - completedAt bilan bir xil
    },

    // Additional fields
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
orderSchema.index({ status: 1, completedAt: 1 }); // ✅ Kassir workflow uchun
orderSchema.index({ status: 1, paidAt: 1 }); // ✅ To'lov holati uchun

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

  // ✅ Status change logic
  if (this.isModified("status")) {
    const now = new Date();

    // Ofitsiant zakaz yopganda
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = now;
      this.closedAt = now; // Backward compatibility
      console.log(`📋 Order completed: ${this.formatted_order_number}`);
    }

    // Kassir to'lov qabul qilganda
    if (this.status === "paid" && !this.paidAt) {
      this.paidAt = now;
      console.log(`💰 Payment received: ${this.formatted_order_number}`);
    }
  }

  next();
});

// Virtual: Formatted order number
orderSchema.virtual("formatted_order_number").get(function () {
  if (!this.daily_order_number) return `#${this._id.toString().slice(-6)}`;
  return `#${String(this.daily_order_number).padStart(3, "0")}`;
});

// ✅ STATIC METHODS - Kassir workflow uchun

// Today's orders count
orderSchema.statics.getTodayOrdersCount = async function () {
  const today = new Date().toISOString().split("T")[0];
  return await this.countDocuments({ order_date: today });
};

// Next order number
orderSchema.statics.getNextOrderNumber = async function () {
  const today = new Date().toISOString().split("T")[0];
  const lastOrder = await this.findOne({ order_date: today })
    .sort({ daily_order_number: -1 })
    .select("daily_order_number");

  return lastOrder ? lastOrder.daily_order_number + 1 : 1;
};

// ✅ Get completed orders (kassir uchun)
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

// ✅ Get pending payments (kassir dashboard uchun)
orderSchema.statics.getPendingPayments = async function () {
  return await this.find({ status: "completed" })
    .populate("user_id", "first_name last_name")
    .populate("table_id", "name number")
    .populate("completedBy", "first_name last_name")
    .sort({ completedAt: 1 }); // Eng eskisi birinchi
};

// ✅ Daily sales summary
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
      },
    },
  ]);

  return (
    result[0] || {
      totalOrders: 0,
      completedOrders: 0,
      paidOrders: 0,
      totalRevenue: 0,
      totalServiceAmount: 0,
      totalTaxAmount: 0,
      avgOrderValue: 0,
    }
  );
};

// ✅ INSTANCE METHODS

// Get order display info
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
    receiptPrinted: this.receiptPrinted,
  };
};

// ✅ Complete order (ofitsiant tomonidan)
orderSchema.methods.completeOrder = async function (completedBy) {
  this.status = "completed";
  this.completedAt = new Date();
  this.completedBy = completedBy;
  this.closedAt = this.completedAt; // Backward compatibility
  return await this.save();
};

// ✅ Process payment (kassir tomonidan)
orderSchema.methods.processPayment = async function (
  paidBy,
  paymentMethod,
  notes
) {
  this.status = "paid";
  this.paidAt = new Date();
  this.paidBy = paidBy;
  this.paymentMethod = paymentMethod;
  if (notes) this.kassirNotes = notes;
  return await this.save();
};

// ✅ Mark receipt as printed
orderSchema.methods.markReceiptPrinted = async function (printedBy) {
  this.receiptPrinted = true;
  this.receiptPrintedAt = new Date();
  this.receiptPrintedBy = printedBy;
  return await this.save();
};

// ✅ Get kassir summary
orderSchema.methods.getKassirSummary = function () {
  return {
    orderNumber: this.formatted_order_number,
    tableNumber: this.table_number,
    waiterName: this.waiter_name,
    itemsCount: this.items.length,
    subtotal: this.total_price,
    serviceAmount: this.service_amount,
    taxAmount: this.tax_amount,
    finalTotal: this.final_total,
    completedAt: this.completedAt,
    status: this.status,
    receiptPrinted: this.receiptPrinted,
    paymentMethod: this.paymentMethod,
    kassirNotes: this.kassirNotes,
  };
};

// Virtual fields ni JSON ga qo'shish
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
