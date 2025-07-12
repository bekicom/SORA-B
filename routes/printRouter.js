const express = require("express");
const PrintService = require("../utils/PrintService");

const router = express.Router();
const printService = new PrintService();

// 🔥 PRINT endpoint - Chiroyli dizayn
router.post("/", async (req, res) => {
  try {
    const { table_number, items, waiter_name, type } = req.body;

    // Ma'lumotlarni tekshirish
    if (!table_number || !items || !waiter_name) {
      return res.status(400).json({
        message: "Majburiy ma'lumotlar yetishmayapti",
        required: ["table_number", "items", "waiter_name"],
      });
    }

    // Print qilish
    const result = await printService.printOrder({
      table_number,
      items,
      waiter_name,
      type,
    });

    res.json(result);
  } catch (err) {
    console.error("Print xatoligi:", err);
    res.status(500).json({
      message: "Chek chiqarishda xatolik",
      error: err.message,
    });
  }
});

module.exports = router;
