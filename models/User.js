const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true },
    last_name: { type: String },
    role: {
      type: String,
      enum: ["admin", "kassir", "ofitsiant"],
      default: "ofitsiant",
    },
    password: { type: String, required: true },
    card_code: { type: String }, // optional RFID card
    user_code: { type: String, unique: true },
    permissions: { type: Object, default: {} }, // huquqlar (prava)
    departments: { type: [String], default: [] }, // bo‘limlar
  },
  {
    timestamps: true,
  }
);

// Parol hash qilish (register/update paytida)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Parolni solishtirish
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
