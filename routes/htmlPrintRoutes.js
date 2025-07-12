const express = require("express");
const HTMLReceiptService = require("../utils/htmlReceiptService");

const router = express.Router();
const htmlReceiptService = new HTMLReceiptService();

// HTML chek endpoint
router.post("/print-html", async (req, res) => {
  try {
    const { table_number, items, waiter_name, type } = req.body;

    if (!table_number || !items || !waiter_name) {
      return res.status(400).json({
        message: "Majburiy ma'lumotlar yetishmayapti",
        required: ["table_number", "items", "waiter_name"],
      });
    }

    const result = await htmlReceiptService.printReceipt({
      table_number,
      items,
      waiter_name,
      type,
    });

    res.json(result);
  } catch (err) {
    console.error("HTML Print xatoligi:", err);
    res.status(500).json({
      message: "HTML chek chiqarishda xatolik",
      error: err.message,
    });
  }
});

// Faqat HTML preview (print qilmasdan)
router.post("/preview-html", async (req, res) => {
  try {
    const { table_number, items, waiter_name, type } = req.body;

    if (!table_number || !items || !waiter_name) {
      return res.status(400).json({
        message: "Majburiy ma'lumotlar yetishmayapti",
        required: ["table_number", "items", "waiter_name"],
      });
    }

    const html = htmlReceiptService.generateReceiptHTML({
      table_number,
      items,
      waiter_name,
      type,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("HTML Preview xatoligi:", err);
    res.status(500).json({
      message: "HTML preview yaratishda xatolik",
      error: err.message,
    });
  }
});

module.exports = router;
