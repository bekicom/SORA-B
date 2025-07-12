const mongoose = require("mongoose");

const CheckSettingSchema = new mongoose.Schema({
  restaurant_name: { type: String, default: "" },
  waiter_name: { type: String, default: "" },
  footer_text: { type: String, default: "" },
  font_size: { type: Number, default: 16 },
  logo_url: { type: String, default: "" },
});

module.exports = mongoose.model("CheckSetting", CheckSettingSchema);
