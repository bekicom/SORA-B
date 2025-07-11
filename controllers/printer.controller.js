const Printer = require("../models/Printer");

// ➕ Yangi printer qo‘shish
exports.createPrinter = async (req, res) => {
  try {
    const { name, ip, location } = req.body;

    const printer = await Printer.create({ name, ip, location });
    res.status(201).json(printer);
  } catch (error) {
    console.error("Printer yaratishda xatolik:", error);
    res.status(500).json({ message: "Printer yaratilmadi" });
  }
};

// 📋 Barcha printerlarni olish
exports.getPrinters = async (req, res) => {
  try {
    const printers = await Printer.find().sort({ createdAt: -1 });
    res.status(200).json(printers);
  } catch (error) {
    console.error("Printerlarni olishda xatolik:", error);
    res.status(500).json({ message: "Printerlar olinmadi" });
  }
};

// 📝 Printerni yangilash
exports.updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip, location } = req.body;

    const updated = await Printer.findByIdAndUpdate(
      id,
      { name, ip, location },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error("Printerni yangilashda xatolik:", error);
    res.status(500).json({ message: "Yangilab bo‘lmadi" });
  }
};

// ❌ Printerni o‘chirish
exports.deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    await Printer.findByIdAndDelete(id);
    res.status(200).json({ message: "Printer o‘chirildi" });
  } catch (error) {
    console.error("Printer o‘chirishda xatolik:", error);
    res.status(500).json({ message: "O‘chirishda xatolik" });
  }
};
