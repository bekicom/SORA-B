const mongoose = require("mongoose"); // ✅ MUHIM

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
      ref: "Category", // ✅ ref qo‘shildi
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Food", foodSchema);
