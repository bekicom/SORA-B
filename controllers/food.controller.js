const Food = require("../models/Food");
const Department = require("../models/department.model");

// ➕ Taom yaratish
const createFood = async (req, res) => {
  try {
    const { name, price, category, department_id } = req.body;

    if (!name || !price || !category || !department_id) {
      return res
        .status(400)
        .json({ message: "Barcha maydonlar to‘ldirilishi kerak" });
    }

    // 🔍 Otdel orqali skladni olish
    const department = await Department.findById(department_id);
    if (!department) {
      return res.status(404).json({ message: "Bo‘lim (otdel) topilmadi" });
    }

    const food = await Food.create({
      name,
      price,
      category,
      department_id,
      warehouse: department.warehouse, // avtomatik
    });

    res.status(201).json({
      message: "Taom yaratildi",
      food,
    });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// 📋 Barcha taomlarni olish
const getAllFoods = async (req, res) => {
  try {
    const foods = await Food.find()
      .populate("department_id", "title warehouse")
      .sort({ createdAt: -1 });

    res.status(200).json({ foods });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// 🔄 Taomni yangilash
const updateFood = async (req, res) => {
  try {
    const { name, price, category, department_id } = req.body;

    if (!name || !price || !category || !department_id) {
      return res
        .status(400)
        .json({ message: "Barcha maydonlar to‘ldirilishi kerak" });
    }

    const department = await Department.findById(department_id);
    if (!department) {
      return res.status(404).json({ message: "Bo‘lim topilmadi" });
    }

    const updated = await Food.findByIdAndUpdate(
      req.params.id,
      {
        name,
        price,
        category,
        department_id,
        warehouse: department.warehouse,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({ message: "Taom topilmadi" });
    }

    res.json({ message: "Taom yangilandi", food: updated });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// ❌ Taomni o‘chirish
const deleteFood = async (req, res) => {
  try {
    const deleted = await Food.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Taom topilmadi" });
    }

    res.json({ message: "Taom o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

module.exports = {
  createFood,
  getAllFoods,
  updateFood,
  deleteFood,
};
