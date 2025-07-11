const Order = require("../models/Order");
const Food = require("../models/Food");

// ✅ Yangi zakaz yaratish
exports.createOrder = async (req, res) => {
  try {
    const { table_id, items } = req.body;
    const user_id = req.user._id; // token orqali keladi

    if (!table_id || !items || items.length === 0) {
      return res.status(400).json({ message: "Ma'lumotlar to‘liq emas" });
    }

    let total_price = 0;
    for (let item of items) {
      const food = await Food.findById(item.food_id);
      if (!food) return res.status(404).json({ message: "Taom topilmadi" });

      total_price += food.price * item.quantity;
      item.name = food.name;
      item.price = food.price;
    }

    const order = await Order.create({
      table_id,
      user_id,
      items,
      total_price,
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("❌ Zakaz yaratishda xatolik:", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
};

// ✅ Stol bo‘yicha zakazlarni olish
exports.getOrdersByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const orders = await Order.find({ table_id: tableId }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Xatolik yuz berdi" });
  }
};

// ✅ Zakaz statusini yangilash
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "preparing", "ready", "served"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Noto‘g‘ri status" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Status yangilanishida xatolik" });
  }
};

// ✅ Zakazni o‘chirish
exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await Order.findByIdAndDelete(orderId);
    res.json({ message: "Zakaz o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: "Zakaz o‘chirishda xatolik" });
  }
};
// orderController.js
exports.getBusyTables = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $in: ["pending", "preparing"] } });
    const busyTableIds = orders.map((o) => o.table_id.toString());
    res.json(busyTableIds);
  } catch (err) {
    res.status(500).json({ message: "Stollarni olishda xatolik" });
  }
};

 exports.getMyPendingOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingOrders = await Order.find({
      user_id: userId,
      status: "pending",
    }).sort({ createdAt: -1 });

    res.status(200).json(pendingOrders);
  } catch (error) {
    console.error("Pending orders error:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

// ✅ Zakazni yopish
exports.closeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔁 Zakaz yopilmoqda, orderId:", orderId); // 👈 log qo‘shildi

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Zakaz topilmadi" });
    }

    if (order.status === "closed") {
      return res.status(400).json({ message: "Zakaz allaqachon yopilgan" });
    }

    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    console.log("✅ Zakaz yopildi:", order._id); // 👈 log qo‘shildi

    res.status(200).json({ message: "Zakaz yopildi", order });
  } catch (err) {
    console.error("❌ Zakaz yopishda xatolik:", err); // 👈 bu log juda muhim
    res.status(500).json({ message: "Zakaz yopishda server xatoligi" });
  }
};

