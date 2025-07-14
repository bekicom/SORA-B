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
    // Qo'shimcha ma'lumotlar (agar kerak bo'lsa)
    category_name: String,
    printer_id: mongoose.Schema.Types.ObjectId,
    printer_ip: String,
    printer_name: String,
  },
  { _id: false }
);

// So'ng order schema
const orderSchema = new mongoose.Schema(
  {
    // 🆕 DAILY ORDER NUMBER SYSTEM (required emas!)
    daily_order_number: {
      type: Number,
      // required: true, // ❌ Olib tashlash
      index: true,
    },
    order_date: {
      type: String, // "2025-07-15" format
      // required: true, // ❌ Olib tashlash
      index: true,
    },

    // Existing fields
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
      enum: ["pending", "preparing", "ready", "served", "closed"],
      default: "pending",
    },
    total_price: {
      type: Number,
      required: true,
    },

    // 🆕 CLOSE ORDER FIELDS
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
    closedAt: {
      type: Date,
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

// 🆕 COMPOUND INDEX: order_date + daily_order_number (unique per day)
orderSchema.index({ order_date: 1, daily_order_number: 1 }, { unique: true });

// 🆕 PRE-SAVE MIDDLEWARE: Auto-generate daily order number
orderSchema.pre("save", async function (next) {
  // Faqat yangi document uchun va agar daily_order_number yo'q bo'lsa
  if (this.isNew && !this.daily_order_number) {
    try {
      // Bugungi sana
      const today = new Date().toISOString().split("T")[0]; // "2025-07-15"
      this.order_date = today;

      // Bugun uchun oxirgi order nomerni topish
      const lastOrder = await this.constructor
        .findOne({ order_date: today })
        .sort({ daily_order_number: -1 })
        .select("daily_order_number");

      // Keyingi nomer
      this.daily_order_number = lastOrder
        ? lastOrder.daily_order_number + 1
        : 1;

      console.log(
        `🆕 Yangi zakaz nomeri: #${this.daily_order_number} (${today})`
      );
    } catch (error) {
      console.error("❌ Daily order number generate xatoligi:", error);
      // Xato bo'lsa ham davom etsin - default qiymatlar bilan
      this.order_date = new Date().toISOString().split("T")[0];
      this.daily_order_number = Date.now() % 1000; // Fallback number
    }
  }
  next();
});

// 🆕 VIRTUAL: Formatted order number
orderSchema.virtual("formatted_order_number").get(function () {
  if (!this.daily_order_number) return `#${this._id.toString().slice(-6)}`;
  return `#${String(this.daily_order_number).padStart(3, "0")}`;
});

// 🆕 STATIC METHOD: Get today's orders count
orderSchema.statics.getTodayOrdersCount = async function () {
  const today = new Date().toISOString().split("T")[0];
  return await this.countDocuments({ order_date: today });
};

// 🆕 STATIC METHOD: Get next order number for today
orderSchema.statics.getNextOrderNumber = async function () {
  const today = new Date().toISOString().split("T")[0];
  const lastOrder = await this.findOne({ order_date: today })
    .sort({ daily_order_number: -1 })
    .select("daily_order_number");

  return lastOrder ? lastOrder.daily_order_number + 1 : 1;
};

// 🆕 INSTANCE METHOD: Get full order display info
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
    closed: this.closedAt,
  };
};

// Virtual fields ni JSON ga qo'shish
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
