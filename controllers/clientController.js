const Client = require("../models/clientModel");

// 🟢 Yangi mijoz qo‘shish
exports.createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 📋 Barcha mijozlarni olish
exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔎 Bitta mijozni olish
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Topilmadi" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Mijozni yangilash
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!client) return res.status(404).json({ message: "Topilmadi" });
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ❌ Mijozni o‘chirish
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: "Topilmadi" });
    res.json({ message: "Muvaffaqiyatli o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔍 Karta raqami bo‘yicha izlash
exports.getClientByCardNumber = async (req, res) => {
  try {
    const client = await Client.findOne({
      card_number: req.params.card_number,
    });
    if (!client) return res.status(404).json({ message: "Topilmadi" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
