const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Mahsulot nomi majburiy"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Mahsulot narxi majburiy"],
      min: [0, "Narx manfiy bo‘lishi mumkin emas"],
    },
    unit: {
      type: String,
      enum: ["dona", "kg", "litr", "sm"],
      required: [true, "Birlik turi majburiy"],
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Kategoriya ID majburiy"],
    },
    image: {
      type: String,
      default: "",
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

module.exports = mongoose.model("Product", productSchema);
