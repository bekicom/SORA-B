const User = require("../models/User");

const validPermissions = ["chek", "atkaz", "hisob"];

// @desc    Admin tomonidan foydalanuvchi yaratish
exports.createUser = async (req, res) => {
  const {
    first_name,
    last_name,
    password,
    role,
    user_code,
    card_code,
    permissions = [],
    percent = 0, // ✅ Percent qo'shildi
  } = req.body;

  // 🔍 DEBUG: Kelgan ma'lumotlarni ko'rish
  console.log("📥 Kelgan ma'lumotlar:", {
    role,
    percent,
    typeof_percent: typeof percent,
  });

  try {
    // ✅ user_code tekshiruvi
    if (user_code) {
      const existing = await User.findOne({ user_code });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Bu user_code allaqachon mavjud" });
      }
    }

    // ✅ card_code tekshiruvi
    if (card_code) {
      const existing = await User.findOne({ card_code });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Bu card_code allaqachon mavjud" });
      }
    }

    // ✅ Ruxsatlar tekshiruvi
    const filteredPermissions = permissions.filter((p) =>
      validPermissions.includes(p)
    );

    // ✅ Percent validation (faqat afitsantlar uchun)
    let validPercent = 0;
    const numericPercent = Number(percent); // String dan Number ga o'girish
    console.log("🔍 Percent validation:", {
      role,
      percent,
      numericPercent,
      condition: role === "afitsant",
    });

    if (
      role === "afitsant" &&
      !isNaN(numericPercent) &&
      numericPercent >= 0 &&
      numericPercent <= 100
    ) {
      validPercent = numericPercent;
      console.log("✅ Percent qabul qilindi:", validPercent);
    } else if (role !== "afitsant" && numericPercent > 0) {
      console.log("❌ Percent faqat afitsantlar uchun");
      return res.status(400).json({
        message: "Percent faqat afitsantlar uchun belgilanishi mumkin",
      });
    }

    console.log("💾 Saqlanayotgan percent:", validPercent);

    const newUser = await User.create({
      first_name,
      last_name,
      password,
      role,
      user_code,
      card_code,
      permissions: filteredPermissions,
      percent: validPercent, // ✅ Percent qo'shildi
    });

    res.status(201).json({
      message: "Foydalanuvchi yaratildi",
      user: { ...newUser._doc, password: undefined },
    });
  } catch (error) {
    console.error("❌ createUser xatolik:", error);
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// @desc    Barcha foydalanuvchilarni olish
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
  const {
    first_name,
    last_name,
    role,
    permissions,
    user_code,
    card_code,
    percent, // ✅ Percent qo'shildi
  } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    // ✅ user_code tekshiruvi
    if (user_code && user_code !== user.user_code) {
      const existing = await User.findOne({ user_code });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Bu user_code allaqachon mavjud" });
      }
    }

    // ✅ card_code tekshiruvi
    if (card_code && card_code !== user.card_code) {
      const existing = await User.findOne({ card_code });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Bu card_code allaqachon mavjud" });
      }
    }

    // ✅ permissions filtr qilish
    const filteredPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => validPermissions.includes(p))
      : user.permissions;

    // ✅ Role va percent validation
    const newRole = role ?? user.role;
    let validPercent = user.percent;

    console.log("🔍 UPDATE - Kelgan ma'lumotlar:", {
      role: newRole,
      percent,
      typeof_percent: typeof percent,
      current_percent: user.percent,
    });

    if (percent !== undefined) {
      const numericPercent = Number(percent);
      console.log("🔍 UPDATE - Percent validation:", {
        newRole,
        percent,
        numericPercent,
        condition: newRole === "afitsant" && !isNaN(numericPercent),
      });

      if (
        newRole === "afitsant" &&
        !isNaN(numericPercent) &&
        numericPercent >= 0 &&
        numericPercent <= 100
      ) {
        validPercent = numericPercent;
        console.log("✅ UPDATE - Percent yangilandi:", validPercent);
      } else if (newRole !== "afitsant" && numericPercent > 0) {
        return res.status(400).json({
          message: "Percent faqat afitsantlar uchun belgilanishi mumkin",
        });
      } else if (newRole !== "afitsant") {
        validPercent = 0; // Agar afitsant bo'lmasa, percent 0 ga o'rnatish
        console.log("⚠️ UPDATE - Afitsant emas, percent 0 ga o'rnatildi");
      }
    }

    console.log("💾 UPDATE - Saqlanayotgan percent:", validPercent);

    // ✅ Yangilash
    user.first_name = first_name ?? user.first_name;
    user.last_name = last_name ?? user.last_name;
    user.role = newRole;
    user.permissions = filteredPermissions;
    user.user_code = user_code ?? user.user_code;
    user.card_code = card_code ?? user.card_code;
    user.percent = validPercent; // ✅ Percent yangilandi

    await user.save();

    res.json({
      message: "Foydalanuvchi yangilandi",
      user: { ...user._doc, password: undefined },
    });
  } catch (error) {
    console.error("❌ updateUser xatolik:", error);
    res
      .status(500)
      .json({ message: "Xatolik yuz berdi", error: error.message });
  }
};

// @desc    Foydalanuvchini o'chirish
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    await user.deleteOne();
    res.json({ message: "Foydalanuvchi o'chirildi" });
  } catch (error) {
    console.error("❌ deleteUser xatolik:", error);
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};
