const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Subkategoriya nomi majburiy"],
      trim: true,
    },
  },
  { _id: false } // subkategoriya uchun alohida _id kerak emas
);

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Kategoriya nomi majburiy"],
      unique: true,
      trim: true,
    },
    printer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Printer",
      default: null,
    },
    subcategories: [subcategorySchema], // subkategoriyalar ichki massiv sifatida
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);
