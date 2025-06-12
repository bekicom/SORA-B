const Category = require("../models/Category");

// ➕ Yaratish
const createCategory = async (req, res) => {
  try {
    const { title } = req.body;

    const exists = await Category.findOne({ title });
    if (exists) {
      return res.status(400).json({ message: "Bu nomli kategoriya mavjud" });
    }

    const category = await Category.create({ title });
    res.status(201).json({ message: "Kategoriya yaratildi", category });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// 📋 Ro‘yxat
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// 📝 Yangilash
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!category)
      return res.status(404).json({ message: "Kategoriya topilmadi" });

    res.json({ message: "Kategoriya yangilandi", category });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// ❌ O‘chirish
const deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Kategoriya topilmadi" });

    res.json({ message: "Kategoriya o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
