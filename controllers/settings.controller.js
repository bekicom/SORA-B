const Setting = require("../models/settings.model");

// 🟢 Yangi sozlama yaratish yoki mavjudini yangilash
exports.createSetting = async (req, res) => {
  try {
    const exists = await Setting.findOne();
    
    if (exists) {
      // Agar mavjud bo'lsa, yangilash
      const updated = await Setting.findOneAndUpdate({}, req.body, {
        new: true,
        runValidators: true
      });
      
      return res.status(200).json({
        message: "Sozlama muvaffaqiyatli yangilandi",
        data: updated,
      });
    }

    // Agar mavjud bo'lmasa, yangi yaratish
    const setting = await Setting.create(req.body);
    return res.status(201).json({
      message: "Sozlama muvaffaqiyatli yaratildi",
      data: setting,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Sozlamani yaratishda server xatosi",
      error: err.message,
    });
  }
};

// 🟡 Sozlamani yangilash
exports.updateSetting = async (req, res) => {
  try {
    const updated = await Setting.findOneAndUpdate({}, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Sozlama topilmadi" });
    }

    return res.json({
      message: "Sozlama yangilandi",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Sozlamani yangilashda server xatosi",
      error: err.message,
    });
  }
};

// 🔵 Sozlamani olish
exports.getSetting = async (req, res) => {
  try {
    const setting = await Setting.findOne();

    if (!setting) {
      return res.status(404).json({ message: "Sozlama topilmadi" });
    }

    return res.json({
      message: "Sozlama topildi",
      data: setting,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Sozlamani olishda server xatosi",
      error: err.message,
    });
  }
};
