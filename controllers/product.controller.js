const Product = require("../models/Product");

// ➕ Mahsulot yaratish
const createProduct = async (req, res) => {
  try {
    const { title, price, unit, category_id, image } = req.body;

    const product = await Product.create({
      title,
      price,
      unit,
      category_id,
      image,
    });

    res.status(201).json({
      message: "Mahsulot yaratildi",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// 📋 Barcha mahsulotlar ro'yxati
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category_id", "title") // faqat kategoriyaning nomini olib kelish
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// 🔄 Mahsulotni yangilash
const updateProduct = async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.json({ message: "Mahsulot yangilandi", product: updated });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

// ❌ Mahsulotni o'chirish
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.json({ message: "Mahsulot o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
};
