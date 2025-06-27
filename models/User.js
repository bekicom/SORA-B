const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: [
        "manager",
        "afitsant",
        "xoctest",
        "kassir",
        "buxgalter",
        "barmen",
        "povir",
        "paner",
      ],
      default: "afitsant",
    },
    password: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    permissions: {
      type: [String],
      enum: ["chek", "atkaz", "hisob"],
      default: [],
    },
  },
  { timestamps: true }
);


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
