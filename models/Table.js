const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Stol nomi majburiy"],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["bo‘sh", "band", "yopilgan"],
      default: "bo‘sh",
    },
    guest_count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Table", tableSchema);
