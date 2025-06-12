const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// @desc    Login qilish
exports.login = async (req, res) => {
  const { user_code, password } = req.body;

  const user = await User.findOne({ user_code });
  if (!user)
    return res.status(401).json({ message: "Foydalanuvchi topilmadi" });

  const isMatch = await user.matchPassword(password);
  if (!isMatch) return res.status(401).json({ message: "Parol noto‘g‘ri" });

  res.json({
    _id: user._id,
    first_name: user.first_name,
    role: user.role,
    token: generateToken(user),
  });
};

// @desc    Faqat admin foydalanuvchi qo‘shadi
exports.register = async (req, res) => {
  const { first_name, last_name, password, role, user_code } = req.body;

  const existing = await User.findOne({ user_code });
  if (existing) return res.status(400).json({ message: "Bu user_code band" });

  const user = await User.create({
    first_name,
    last_name,
    password,
    role,
    user_code,
  });
  res.status(201).json({ message: "Foydalanuvchi yaratildi", user });
};

// @desc    Token orqali userni olish
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.json(user);
};
