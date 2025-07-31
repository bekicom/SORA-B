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

    // ✅ Mahsulot soni (sklad uchun)
    quantity: {
      type: Number,
      default: 0,
      min: [0, "Mahsulot soni manfiy bo‘lishi mumkin emas"],
    },

    // ✅ Yaroqlilik muddati (srok)
    expiration_date: {
      type: Date,
      required: [true, "Yaroqlilik muddati (srok) kiritilishi kerak"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Food", foodSchema);
