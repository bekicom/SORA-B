const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Taom nomi majburiy"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Narx majburiy"],
      min: [0, "Narx manfiy bo‘lishi mumkin emas"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Kategoriya majburiy"],
      trim: true,
    },
    subcategory: {
      type: String, // Subkategoriya nomi matn bo‘lib keladi
      default: "",
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Bo‘lim ID majburiy"],
    },
    warehouse: {
      type: String,
    },
    unit: {
      type: String,
      enum: ["dona", "kg", "litr", "metr", "gramm", "sm", "bek"],
      required: [true, "Birlik tanlanishi shart"],
    },

    // 🟢 1. Skladdagi mavjud soni
    soni: {
      type: Number,
      required: [true, "Soni (sklad) majburiy"],
      min: [0, "Soni manfiy bo‘lishi mumkin emas"],
      default: 0,
    },

    // 🟢 2. Yaroqlilik muddati (sana formatida)
    expiration: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Food", foodSchema);
