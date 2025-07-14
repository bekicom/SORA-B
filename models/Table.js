const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Stol nomi majburiy"],
      unique: true,
      trim: true,
    },
    // 🆕 TABLE NUMBER (display uchun)
    number: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["bo'sh", "band", "yopilgan"],
      default: "bo'sh",
    },
    guest_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    // 🆕 ADDITIONAL FIELDS
    capacity: {
      type: Number,
      default: 4,
      min: 1,
      max: 20,
    },
    description: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🆕 VIRTUAL: Display name (agar number mavjud bo'lsa)
tableSchema.virtual("display_name").get(function () {
  return this.number || this.name;
});

// 🆕 INSTANCE METHOD: Get table info for orders
tableSchema.methods.getTableInfo = function () {
  return {
    id: this._id,
    name: this.name,
    number: this.number,
    display_name: this.display_name,
    status: this.status,
    guest_count: this.guest_count,
    capacity: this.capacity,
  };
};

// 🆕 STATIC METHOD: Find active tables
tableSchema.statics.findActiveTables = function () {
  return this.find({ is_active: true }).sort({ name: 1 });
};

// 🆕 STATIC METHOD: Find available tables
tableSchema.statics.findAvailableTables = function () {
  return this.find({
    is_active: true,
    status: "bo'sh",
  }).sort({ name: 1 });
};

// 🆕 PRE-SAVE: Auto-set number from name if not provided
tableSchema.pre("save", function (next) {
  // Agar number yo'q bo'lsa, name dan olish
  if (!this.number && this.name) {
    // "Stol 3" -> "3", "A1" -> "A1", "VIP-5" -> "VIP-5"
    const numberMatch = this.name.match(/(\d+|[A-Za-z]+\d*)/);
    if (numberMatch) {
      this.number = numberMatch[0];
    } else {
      this.number = this.name;
    }
  }
  next();
});

// Virtual fields ni JSON ga qo'shish
tableSchema.set("toJSON", { virtuals: true });
tableSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Table", tableSchema);
