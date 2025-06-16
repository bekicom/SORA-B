const Order = require("../models/Order");
const Product = require("../models/Product");

// ➕ Buyurtma yaratish
exports.createOrder = async (req, res) => {
  try {
    const { table_id, items } = req.body;

    if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Stol va mahsulotlar kerak" });
    }

    let total = 0;

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      if (!product)
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      total += product.price * (item.quantity || 1);
    }

    const newOrder = await Order.create({
      table_id,
      items,
      total_price: total,
      created_by: req.user?._id, // token orqali aniqlansa
    });

    res.status(201).json({ message: "Buyurtma yaratildi", order: newOrder });
  } catch (error) {
    res.status(500).json({ message: "Server xatoligi", error: error.message });
  }
};

// 📋 Barcha buyurtmalar ro‘yxati
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("table_id", "title")
      .populate("items.product_id", "title price")
      .populate("created_by", "first_name role")
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Xatolik", error: error.message });
  }
};
