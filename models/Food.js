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
      required: [true, "Kategoriya majburiy"],
      trim: true,
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Bo‘lim ID majburiy"],
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse", // agar sizda Warehouse modeli mavjud bo‘lsa
      required: [true, "Sklad avtomatik bo‘lsa-da, saqlanishi shart"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Food", foodSchema);
