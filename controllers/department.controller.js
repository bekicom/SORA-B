const Department = require("../models/department.model");

// 🔹 Yangi bo‘lim yaratish
exports.createDepartment = async (req, res) => {
  try {
    const { title, warehouse } = req.body;

    if (!title || !warehouse) {
      return res.status(400).json({ message: "title va warehouse majburiy" });
    }

    const newDepartment = await Department.create({ title, warehouse });
    res.status(201).json(newDepartment);
  } catch (error) {
    res.status(500).json({ message: "Yaratishda xatolik", error });
  }
};

// 🔹 Barcha bo‘limlarni olish
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: "Ma'lumotlarni olishda xatolik", error });
  }
};

// 🔹 Bo‘limni yangilash
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, warehouse } = req.body;

    if (!title || !warehouse) {
      return res.status(400).json({ message: "title va warehouse majburiy" });
    }

    const updated = await Department.findByIdAndUpdate(
      id,
      { title, warehouse },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Yangilashda xatolik", error });
  }
};

// 🔹 Bo‘limni o‘chirish
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await Department.findByIdAndDelete(id);
    res.status(200).json({ message: "Bo‘lim o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "O‘chirishda xatolik", error });
  }
};
