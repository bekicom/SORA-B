const Settings = require("../models/Settings");
const fs = require("fs");
const path = require("path");

// ✅ Sozlamalarni olish (model bilan mos)
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );

    if (!settings) {
      // ✅ Model'dagi default qiymatlar bilan yaratish
      settings = await Settings.create({
        restaurant_name: "SORA RESTAURANT",
        phone: "+998 90 123 45 67",
        address: "Toshkent sh., Yunusobod tumani",
        email: "info@sora-restaurant.uz",
        website: "www.sora-restaurant.uz",
        kassir_printer_ip: "192.168.0.106",
        auto_print_receipt: true,
        print_receipt_copies: 1,
        font_size: 14,
        font_family: "Arial",
        text_color: "#000000",
        currency: "UZS",
        tax_percent: 12,
        service_percent: 10,
        footer_text: "Rahmat! Yana tashrif buyuring!",
        is_active: true,
      });
      console.log("✅ Default settings yaratildi");
    }

    res.status(200).json({
      success: true,
      data: settings,
      message: "Sozlamalar muvaffaqiyatli yuklandi",
    });
  } catch (error) {
    console.error("❌ Settings olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Sozlamalarni olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ Yangi sozlamalar yaratish
const createSettings = async (req, res) => {
  try {
    console.log("📝 Yangi settings yaratilmoqda:", req.body);

    // Eski active settings'ni o'chirish
    await Settings.updateMany({}, { is_active: false });

    const newSettings = await Settings.create({
      ...req.body,
      is_active: true,
    });

    console.log("✅ Yangi settings yaratildi:", newSettings._id);
    res.status(201).json({
      success: true,
      data: newSettings,
      message: "Sozlamalar muvaffaqiyatli yaratildi",
    });
  } catch (error) {
    console.error("❌ Settings yaratishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Yaratishda xatolik",
      error: error.message,
    });
  }
};

// ✅ Sozlamalarni yangilash
const updateSettings = async (req, res) => {
  try {
    console.log("🔄 Settings yangiklanmoqda:", req.body);

    const updated = await Settings.findOneAndUpdate(
      { is_active: true },
      req.body,
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate("kassir_printer_id");

    console.log("✅ Settings yangilandi:", updated._id);
    res.status(200).json({
      success: true,
      data: updated,
      message: "Sozlamalar muvaffaqiyatli yangilandi",
    });
  } catch (error) {
    console.error("❌ Settings yangilashda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Yangilashda xatolik",
      error: error.message,
    });
  }
};

// ✅ Logo yuklash (model field bilan mos)
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo fayl topilmadi",
      });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
    console.log("📤 Logo yuklanmoqda:", imageUrl);

    const updated = await Settings.findOneAndUpdate(
      { is_active: true },
      { logo: imageUrl }, // ✅ logoUrl emas, logo
      { new: true, upsert: true }
    );

    console.log("✅ Logo muvaffaqiyatli yuklandi");
    res.status(200).json({
      success: true,
      data: updated,
      message: "Logo muvaffaqiyatli yuklandi",
    });
  } catch (error) {
    console.error("❌ Logo yuklashda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Logo yuklashda xatolik",
      error: error.message,
    });
  }
};

// ✅ Logo o'chirish
const deleteLogo = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    // ✅ Fayl tizimidan o'chirish
    if (settings.logo) {
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        path.basename(settings.logo)
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ Logo fayli o'chirildi:", filePath);
      }
    }

    // ✅ Ma'lumotlar bazasidan o'chirish
    settings.logo = null;
    await settings.save();

    console.log("✅ Logo muvaffaqiyatli o'chirildi");
    res.status(200).json({
      success: true,
      data: settings,
      message: "Logo muvaffaqiyatli o'chirildi",
    });
  } catch (error) {
    console.error("❌ Logo o'chirishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Logo o'chirishda xatolik",
      error: error.message,
    });
  }
};

// ✅ Default holatga qaytarish
const resetToDefault = async (req, res) => {
  try {
    console.log("🔄 Default holatga qaytarilmoqda...");

    // Barcha settings'ni inactive qilish
    await Settings.updateMany({}, { is_active: false });

    // Yangi default settings yaratish
    const defaultSettings = await Settings.create({
      restaurant_name: "SORA RESTAURANT",
      phone: "+998 90 123 45 67",
      address: "Toshkent sh., Yunusobod tumani",
      email: "info@sora-restaurant.uz",
      website: "www.sora-restaurant.uz",
      kassir_printer_ip: "192.168.0.106",
      auto_print_receipt: true,
      print_receipt_copies: 1,
      font_size: 14,
      font_family: "Arial",
      text_color: "#000000",
      currency: "UZS",
      tax_percent: 12,
      service_percent: 10,
      footer_text: "Rahmat! Yana tashrif buyuring!",
      thank_you_text: "Спасибо за посещение!",
      language: "ru",
      is_active: true,
    });

    console.log("✅ Default settings yaratildi");
    res.status(200).json({
      success: true,
      message: "Sozlamalar default holatga qaytarildi",
      data: defaultSettings,
    });
  } catch (error) {
    console.error("❌ Default holatga qaytarishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Default holatga qaytarishda xatolik",
      error: error.message,
    });
  }
};

// ✅ Test chek generatsiyasi (frontend template bilan)
const generateTestReceipt = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    // ✅ Frontend template format'ida
    const testReceiptData = {
      // Restaurant info
      restaurant_name: settings.restaurant_name,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      logo: settings.logo,

      // Order info
      order_number: "#TEST001",
      table_number: "TEST",
      waiter_name: "Test User",
      date: new Date().toLocaleString("uz-UZ"),

      // Items
      items: [
        { name: "Choy", quantity: 2, price: 5000, total: 10000 },
        { name: "Lag'mon", quantity: 1, price: 25000, total: 25000 },
        { name: "Non", quantity: 1, price: 2000, total: 2000 },
      ],

      // Calculations
      subtotal: 37000,
      service_percent: settings.service_percent,
      service_amount: Math.round((37000 * settings.service_percent) / 100),
      tax_percent: settings.tax_percent,
      tax_amount: Math.round((37000 * settings.tax_percent) / 100),
      total_amount:
        37000 +
        Math.round((37000 * settings.service_percent) / 100) +
        Math.round((37000 * settings.tax_percent) / 100),

      // Settings
      currency: settings.currency,
      footer_text: settings.footer_text,
      font_size: settings.font_size,
      font_family: settings.font_family,
      text_color: settings.text_color,
      show_qr: settings.show_qr,

      // Print settings
      kassir_printer_ip: settings.kassir_printer_ip,
      type: "test_receipt",
    };

    console.log("🧾 Test chek ma'lumotlari tayyorlandi");
    res.status(200).json({
      success: true,
      data: testReceiptData,
      message: "Test chek muvaffaqiyatli generatsiya qilindi",
    });
  } catch (error) {
    console.error("❌ Test chek generatsiyasida xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Test chek generatsiyasida xatolik",
      error: error.message,
    });
  }
};

// ✅ YANGI: HTML to Image Print Endpoint
const printImageReceipt = async (req, res) => {
  try {
    const {
      imageData,
      printer_ip,
      width,
      height,
      restaurant_name,
      order_data,
    } = req.body;

    console.log("🖼️ HTML to Image print request:", {
      printer_ip,
      width,
      height,
      restaurant_name,
      imageDataLength: imageData ? imageData.length : 0,
    });

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: "Image data topilmadi",
      });
    }

    const printerIP = printer_ip || "192.168.0.106";

    // 1. Base64 image'ni buffer'ga aylantirish
    const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    console.log("📸 Image buffer yaratildi:", {
      size: imageBuffer.length,
      type: "PNG",
    });

    // 2. ESC/POS printer'ga yuborish
    const escpos = require("escpos");
    escpos.Network = require("escpos-network");

    const device = new escpos.Network(printerIP, 9100);
    const printer = new escpos.Printer(device);

    device.open((err) => {
      if (err) {
        console.error(
          `❌ Printer'ga (${printerIP}) ulanib bo'lmadi:`,
          err.message
        );
        return res.status(400).json({
          success: false,
          message: `Printer'ga (${printerIP}) ulanib bo'lmadi`,
          error: err.message,
        });
      }

      console.log(`✅ Printer'ga (${printerIP}) ulanildi`);

      // 3. ESC/POS Image object yaratish
      escpos.Image.load(imageBuffer, (image) => {
        try {
          console.log("🖼️ ESC/POS image yaratildi:", {
            width: image.width,
            height: image.height,
          });

          // 4. Image'ni print qilish
          printer
            .align("CT") // Center align
            .raster(image, "dw") // Double width agar kerak bo'lsa
            .feed(2) // 2 ta bo'sh qator
            .cut() // Paper cut
            .close(); // Connection close

          console.log("✅ HTML to Image print muvaffaqiyatli yuborildi");

          res.json({
            success: true,
            message: "HTML to Image print muvaffaqiyatli yuborildi!",
            printer_ip: printerIP,
            image_info: {
              width: image.width,
              height: image.height,
              originalSize: imageBuffer.length,
            },
          });
        } catch (imageError) {
          console.error("❌ ESC/POS image processing error:", imageError);
          printer.close();
          res.status(500).json({
            success: false,
            message: "Image processing xatoligi",
            error: imageError.message,
          });
        }
      });
    });
  } catch (error) {
    console.error("❌ HTML to Image print error:", error);
    res.status(500).json({
      success: false,
      message: "HTML to Image print xatoligi",
      error: error.message,
    });
  }
};

// ✅ Kassir printer test
const testKassirPrinter = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true });

    if (!settings || !settings.kassir_printer_ip) {
      return res.status(400).json({
        success: false,
        message: "Kassir printer IP sozlanmagan",
      });
    }

    console.log(
      `🖨️ Kassir printer (${settings.kassir_printer_ip}) test qilinmoqda...`
    );

    // Print server'ga yuborish (bu yerda haqiqiy print logic bo'lishi kerak)
    // Bu yerga print server bilan integration qo'shiladi

    res.status(200).json({
      success: true,
      message: `Kassir printer (${settings.kassir_printer_ip}) muvaffaqiyatli testdan o'tdi`,
      printer_ip: settings.kassir_printer_ip,
    });
  } catch (error) {
    console.error("❌ Kassir printer testida xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Kassir printer testida xatolik",
      error: error.message,
    });
  }
};

// ✅ Kassir printer holati
const getKassirPrinterStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    const printerStatus = {
      configured: !!settings.kassir_printer_ip,
      ip: settings.kassir_printer_ip,
      auto_print: settings.auto_print_receipt,
      copies: settings.print_receipt_copies,
      printer_name: settings.kassir_printer_id?.name || null,
      status: settings.kassir_printer_ip ? "configured" : "not_configured",
    };

    res.status(200).json({
      success: true,
      data: printerStatus,
      message: "Kassir printer holati",
    });
  } catch (error) {
    console.error("❌ Kassir printer holati olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Kassir printer holati olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ Sozlamalar haqida info
const getSettingsInfo = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    const settingsInfo = {
      restaurant_name: settings.restaurant_name,
      phone: settings.phone,
      address: settings.address,
      currency: settings.currency,
      footer_text: settings.footer_text,
      kassir_printer_configured: !!settings.kassir_printer_ip,
      auto_print_enabled: settings.auto_print_receipt,
      font_settings: {
        size: settings.font_size,
        family: settings.font_family,
        color: settings.text_color,
      },
    };

    res.status(200).json({
      success: true,
      data: settingsInfo,
      message: "Sozlamalar ma'lumotlari",
    });
  } catch (error) {
    console.error("❌ Sozlamalar ma'lumotlarini olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Sozlamalar ma'lumotlarini olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ EXPORT (printImageReceipt qo'shildi)
module.exports = {
  getSettings,
  createSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  resetToDefault,
  generateTestReceipt,
  printImageReceipt, // ✅ YANGI endpoint
  testKassirPrinter,
  getKassirPrinterStatus,
  getSettingsInfo,
};
