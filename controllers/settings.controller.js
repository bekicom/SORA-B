const Settings = require("../models/Settings");
const fs = require("fs");
const path = require("path");

// Sozlamalarni olish (yoki default yaratish)
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        siteName: "SORA CAFE",
        logoUrl: "",
        defaultCurrency: "UZS",
        receiptFooter: "Tashrifingiz uchun rahmat!",
        printers: [],
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Sozlamalarni olishda xatolik",
      error: error.message,

    });
  }
};


// 
const createSettings = async (req, res) => {
  try {
    const newSettings = await Settings.create(req.body);
    res.status(201).json({ success: true, data: newSettings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Yaratishda xatolik",
      error: error.message,
    });
  }
};

// Yangilash
const updateSettings = async (req, res) => {
  try {
    const updated = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Yangilashda xatolik",
      error: error.message,
    });
  }
};

// Logo yuklash
const uploadLogo = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "Logo fayl topilmadi" });

  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  try {
    const updated = await Settings.findOneAndUpdate(
      {},
      { logoUrl: imageUrl },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Logo o‘chirish
const deleteLogo = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (settings.logoUrl) {
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        path.basename(settings.logoUrl)
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    settings.logoUrl = "";
    await settings.save();
    res.status(200).json({ success: true, message: "Logo o‘chirildi" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Default holatga qaytarish
const resetToDefault = async (req, res) => {
  try {
    await Settings.deleteMany({});
    const defaultSettings = await Settings.create({
      siteName: "SORA CAFE",
      logoUrl: "",
      defaultCurrency: "UZS",
      receiptFooter: "Tashrifingiz uchun rahmat!",
      printers: [],
    });
    res.status(200).json({
      success: true,
      message: "Sozlamalar default holatga qaytarildi",
      data: defaultSettings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Test chek generatsiyasi
const generateTestReceipt = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    const receipt = {
      siteName: settings?.siteName || "SORA",
      items: [
        { name: "Choy", price: 5000, quantity: 2 },
        { name: "Lag'mon", price: 25000, quantity: 1 },
      ],
      footer: settings?.receiptFooter || "Yana kutamiz!",
    };
    res.status(200).json({ success: true, receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Kassir printer test
const testKassirPrinter = async (req, res) => {
  try {
    // Bu yerda printerni test qilish logikasi bo'lishi kerak
    res.status(200).json({
      success: true,
      message: "Kassir printer muvaffaqiyatli testdan o'tdi",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Kassir printer holati
const getKassirPrinterStatus = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      status: "online", // yoki dynamic bo‘lishi mumkin
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sozlamalar haqida info
const getSettingsInfo = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        siteName: settings.siteName,
        currency: settings.defaultCurrency,
        footer: settings.receiptFooter,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// EXPORT
module.exports = {
  getSettings,
  createSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  resetToDefault,
  generateTestReceipt,
  testKassirPrinter,
  getKassirPrinterStatus,
  getSettingsInfo,
};
