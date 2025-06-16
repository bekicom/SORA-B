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
      default: "", // ⬅️ optional: bo‘sh qoldirilsa ham bo‘ladi
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔄 virtual: kategoriya ma'lumotlarini avtomatik qo‘shish (ixtiyoriy)
productSchema.virtual("category", {
  ref: "Category",
  localField: "category_id",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("Product", productSchema);
