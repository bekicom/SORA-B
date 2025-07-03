const Category = require("../models/Category");

// ➕ Kategoriya yaratish
const createCategory = async (req, res) => {
  try {
    const { title } = req.body;

    // Tekshir: shu nomli kategoriya mavjudmi
    const existing = await Category.findOne({ title });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Bu nomli kategoriya allaqachon mavjud" });
    }

    const newCategory = await Category.create({ title });
    res.status(201).json({
      message: "Kategoriya muvaffaqiyatli yaratildi",
      category: newCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik", error: error.message });
  }
};

// 📋 Barcha kategoriyalar ro'yxati
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik", error: error.message });
  }
};

// 📝 Kategoriya yangilash
const updateCategory = async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Kategoriya topilmadi" });
    }

    res.status(200).json({
      message: "Kategoriya yangilandi",
      category: updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik", error: error.message });
  }
};

// ❌ Kategoriya o‘chirish
const deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Kategoriya topilmadi" });
    }

    res.status(200).json({ message: "Kategoriya o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik", error: error.message });
  }
};

// ✅ Export
module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
