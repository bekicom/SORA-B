const CheckSetting = require("../models/checkSettings.model");

// GET - sozlamani olish
exports.getCheckSettings = async (req, res) => {
  try {
    let settings = await CheckSetting.findOne();
    if (!settings) {
      settings = await CheckSetting.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Sozlamalarni olishda xatolik" });
  }
};

// POST - sozlamani yangilash
exports.updateCheckSettings = async (req, res) => {
  try {
    const existing = await CheckSetting.findOne();
    if (existing) {
      await CheckSetting.findByIdAndUpdate(existing._id, req.body, {
        new: true,
      });
      res.json({ message: "Sozlamalar yangilandi" });
    } else {
      await CheckSetting.create(req.body);
      res.json({ message: "Sozlamalar yaratildi" });
    }
  } catch (err) {
    res.status(500).json({ message: "Sozlamalarni saqlashda xatolik" });
  }
};
