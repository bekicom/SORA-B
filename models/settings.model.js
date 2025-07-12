const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    restaurant_name: { type: String,  },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    logo: { type: String, default: "" }, // base64 yoki URL
    font_size: { type: Number, default: 14 },
    font_family: { type: String, default: "Arial" },
    text_color: { type: String, default: "#000000" },
    show_qr: { type: Boolean, default: true },
    show_deposit: { type: Boolean, default: true },
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingsSchema);
