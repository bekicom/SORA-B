const mongoose = require("mongoose");

// Avval item schema yaratiladi
const orderItemSchema = new mongoose.Schema(
  {
    food_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

// So‘ng order schema
const orderSchema = new mongoose.Schema(
  {
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema], // ✅ Bu joyda item schema ishlatilmoqda
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "closed"],
      default: "pending",
    },
    total_price: {
      type: Number,
      required: true,
    },
    kitchen_print_template: {
      type: String,
      default: "",
    },
    printer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Printer" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
