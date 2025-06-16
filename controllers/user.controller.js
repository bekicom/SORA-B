const User = require("../models/User");

// @desc    Admin tomonidan foydalanuvchi yaratish
exports.createUser = async (req, res) => {
  const {
    first_name,
    last_name,
    password,
    role,
    user_code,
    card_code,
    permissions,
    departments,
  } = req.body;

  try {
    const existing = await User.findOne({ user_code });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Bu user_code allaqachon mavjud" });
    }

    const newUser = await User.create({
      first_name,
      last_name,
      password,
      role,
      user_code,
      card_code,
      permissions,
      departments,
    });

    res.status(201).json({ message: "Foydalanuvchi yaratildi", user: newUser });
  } catch (error) {
    console.error("❌ createUser xatolik:", error);
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi" });
  }
};



// @desc    Foydalanuvchini yangilash
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, role, departments, permissions } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.role = role || user.role;
    user.departments = departments || user.departments;
    user.permissions = permissions || user.permissions;

    await user.save();
    res.json({ message: "Foydalanuvchi yangilandi", user });
  } catch (error) {
    console.error("❌ updateUser xatolik:", error);
    res
      .status(500)
      .json({ message: "Xatolik yuz berdi", error: error.message });
  }
};

// @desc    Foydalanuvchini o‘chirish
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    await user.deleteOne();
    res.json({ message: "Foydalanuvchi o‘chirildi" });
  } catch (error) {
    console.error("❌ deleteUser xatolik:", error);
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};
