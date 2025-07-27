const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Stol nomi majburiy"],
      unique: true,
      trim: true,
    },
    number: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["bo'sh", "band", "yopilgan"],
      default: "bo'sh",
    },
    guest_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    // 🆕 ADDITIONAL FIELDS
    capacity: {
      type: Number,
      default: 4,
      min: 1,
      max: 20,
    },
    description: {
      type: String,
      trim: true,
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
tableSchema.virtual("display_name").get(function () {
  return this.number || this.name;
});
tableSchema.methods.getTableInfo = function () {
  return {
    id: this._id,
    name: this.name,
    number: this.number,
    display_name: this.display_name,
    status: this.status,
    guest_count: this.guest_count,
    capacity: this.capacity,
  };
};
tableSchema.statics.findActiveTables = function () {
  return this.find({ is_active: true }).sort({ name: 1 });
};
tableSchema.statics.findAvailableTables = function () {
  return this.find({
    is_active: true,
    status: "bo'sh",
  }).sort({ name: 1 });
};
tableSchema.pre("save", function (next) {
  if (!this.number && this.name) {
    const numberMatch = this.name.match(/(\d+|[A-Za-z]+\d*)/);
    if (numberMatch) {
      this.number = numberMatch[0];
    } else {
      this.number = this.name;
    }
  }
  next();
});

tableSchema.set("toJSON", { virtuals: true });
tableSchema.set("toObject", { virtuals: true });
module.exports = mongoose.model("Table", tableSchema);
