const Category = require("../models/Category");

// ➕ Kategoriya yaratish (subcategories bilan)
const createCategory = async (req, res) => {
  try {
    const { title, printer_id, subcategories = [] } = req.body;

    const existing = await Category.findOne({ title });
    if (existing) {
      return res.status(400).json({ message: "Bu nomli kategoriya mavjud" });
    }

    // Subkategoriyalarni formatlash
    const formattedSubcategories = subcategories.map((sub) =>
      typeof sub === "string" ? { title: sub } : sub
    );

    const newCategory = await Category.create({
      title,
      printer_id: printer_id || null,
      subcategories: formattedSubcategories,
    });

    res.status(201).json({
      message: "Kategoriya yaratildi",
      category: newCategory,
    });
  } catch (error) {
    res.status(500).json({
      message: "Serverda xatolik",
      error: error.message,
    });
  }
};

// 📋 Barcha kategoriyalar ro'yxati (printer_id va subcategories bilan)
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .populate("printer_id", "name ip")
      .sort({ createdAt: -1 });

    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({
      message: "Serverda xatolik",
      error: error.message,
    });
  }
};

// 📝 Kategoriya yangilash (subcategories ni ham yangilaydi)
const updateCategory = async (req, res) => {
  try {
    const { title, printer_id, subcategories = [] } = req.body;

    const formattedSubcategories = subcategories.map((sub) =>
      typeof sub === "string" ? { title: sub } : sub
    );

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      {
        title,
        printer_id: printer_id || null,
        subcategories: formattedSubcategories,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Kategoriya topilmadi",
      });
    }

    res.status(200).json({
      message: "Kategoriya yangilandi",
      category: updated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Serverda xatolik",
      error: error.message,
    });
  }
};

// ❌ Kategoriya o‘chirish
const deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        message: "Kategoriya topilmadi",
      });
    }

    res.status(200).json({
      message: "Kategoriya o‘chirildi",
    });
  } catch (error) {
    res.status(500).json({
      message: "Serverda xatolik",
      error: error.message,
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
