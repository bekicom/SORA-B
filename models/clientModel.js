const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Mijoz ismi majburiy"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Telefon raqami majburiy"],
      unique: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    card_number: {
      type: String,
      required: [true, "Karta raqami majburiy"],
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);
