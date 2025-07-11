const mongoose = require("mongoose");

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
      ref: "Printer", // 👉 printer model bilan bog'laymiz
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);
