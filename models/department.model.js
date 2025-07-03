const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Bo‘lim nomi majburiy"],
      trim: true,
    },
    warehouse: {
      type: String,
      required: [true, "Bo‘limga biriktirilgan ombor nomi majburiy"],
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
