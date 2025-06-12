const Table = require("../models/Table");

// ➕ Yangi stol yaratish
const createTable = async (req, res) => {
  try {
    const { name, guest_count } = req.body;

    const newTable = await Table.create({
      name,
      guest_count: guest_count || 0,
    });

    res.status(201).json({
      message: "Stol yaratildi",
      table: newTable,
    });
  } catch (error) {
    res.status(500).json({
      message: "Xatolik",
      error: error.message,
    });
  }
};

// 📋 Barcha stollarni olish
const getTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ createdAt: -1 });
    res.status(200).json(tables);
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// 📝 Stolni yangilash (status yoki guest_count yoki name)
const updateTable = async (req, res) => {
  try {
    const updated = await Table.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Stol topilmadi" });
    }

    res.status(200).json({
      message: "Stol yangilandi",
      table: updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// ❌ Stolni o‘chirish
const deleteTable = async (req, res) => {
  try {
    const deleted = await Table.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Stol topilmadi" });
    }

    res.status(200).json({ message: "Stol o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

module.exports = {
  createTable,
  getTables,
  updateTable,
  deleteTable,
};
