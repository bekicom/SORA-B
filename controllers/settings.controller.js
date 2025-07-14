const Settings = require("../models/Settings");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp"); // Rasm o'lchami o'zgartirish uchun

// 📁 File upload konfiguratsiyasi
const storage = multer.memoryStorage(); // Memory da saqlash

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error("Faqat rasm fayllari (JPEG, PNG, GIF, WebP) ruxsat etilgan!")
      );
    }
  },
}).single("logo");

// 🎨 Rasm ni optimize qilish
const optimizeImage = async (buffer) => {
  try {
    const optimized = await sharp(buffer)
      .resize(300, 150, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    return `data:image/jpeg;base64,${optimized.toString("base64")}`;
  } catch (error) {
    console.error("Rasm optimize qilishda xatolik:", error);
    // Agar optimize bo'lmasa, original ni qaytarish
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }
};

// 📖 Sozlamalarni olish
const getSettings = async (req, res) => {
  try {
    console.log("🔍 Sozlamalar so'ralmoqda...");

    const settings = await Settings.findOrCreate();

    console.log("✅ Sozlamalar topildi:", settings._id);

    res.status(200).json({
      success: true,
      message: "Sozlamalar muvaffaqiyatli olindi",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Sozlamalarni olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Sozlamalarni olishda xatolik",
      error: error.message,
    });
  }
};

// ➕ Sozlamalarni yaratish
const createSettings = async (req, res) => {
  try {
    console.log("📝 Yangi sozlamalar yaratilmoqda:", req.body);

    // Mavjud sozlamalarni tekshirish
    const existingSettings = await Settings.findOne({ is_active: true });
    if (existingSettings) {
      // Agar mavjud bo'lsa, update qilish
      return updateSettings(req, res);
    }

    const settingsData = {
      ...req.body,
      created_by: req.user?.id || null,
      is_active: true,
    };

    const newSettings = await Settings.create(settingsData);

    console.log("✅ Yangi sozlamalar yaratildi:", newSettings._id);

    res.status(201).json({
      success: true,
      message: "Sozlamalar muvaffaqiyatli yaratildi",
      data: newSettings,
    });
  } catch (error) {
    console.error("❌ Sozlamalar yaratishda xatolik:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validatsiya xatoligi",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Sozlamalar yaratishda xatolik",
      error: error.message,
    });
  }
};

// ✏️ Sozlamalarni yangilash
const updateSettings = async (req, res) => {
  try {
    console.log("🔄 Sozlamalar yangilanmoqda:", req.body);

    let settings = await Settings.findOne({ is_active: true });

    if (!settings) {
      console.log("🆕 Sozlamalar topilmadi, yangi yaratilmoqda...");
      const settingsData = {
        ...req.body,
        created_by: req.user?.id || null,
        is_active: true,
      };
      settings = await Settings.create(settingsData);
    } else {
      console.log("📝 Mavjud sozlamalar yangilanmoqda:", settings._id);

      // Faqat ruxsat etilgan maydonlarni yangilash
      const allowedFields = [
        "restaurant_name",
        "address",
        "phone",
        "email",
        "website",
        "logo",
        "font_size",
        "font_family",
        "text_color",
        "currency",
        "tax_percent",
        "service_percent",
        "show_qr",
        "show_deposit",
        "show_logo",
        "footer_text",
        "thank_you_text",
        "additional_text",
        "deposit_text",
        "language",
        "receipt_width",
        "auto_print",
        "print_copies",
        "qr_code_size",
        "qr_code_content",
        "tax_number",
        "license_number",
        "theme",
        "social_media",
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === "theme" || field === "social_media") {
            // Object fieldlarni merge qilish
            settings[field] = {
              ...(settings[field] || {}),
              ...req.body[field],
            };
          } else {
            settings[field] = req.body[field];
          }
        }
      });

      settings.updated_by = req.user?.id || null;
      await settings.save();
    }

    console.log("✅ Sozlamalar muvaffaqiyatli yangilandi");

    res.status(200).json({
      success: true,
      message: "Sozlamalar muvaffaqiyatli yangilandi",
      data: settings,
    });
  } catch (error) {
    console.error("❌ Sozlamalarni yangilashda xatolik:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validatsiya xatoligi",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Sozlamalarni yangilashda xatolik",
      error: error.message,
    });
  }
};

// 🖼️ Logo yuklash
const uploadLogo = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error("❌ File upload xatoligi:", err);
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Logo fayli tanlanmagan",
        });
      }

      console.log("📁 Logo yuklanmoqda:", req.file.originalname);

      try {
        // Rasm ni optimize qilish
        const optimizedLogo = await optimizeImage(req.file.buffer);

        // Sozlamalarga saqlash
        let settings = await Settings.findOne({ is_active: true });
        if (!settings) {
          settings = await Settings.findOrCreate();
        }

        settings.logo = optimizedLogo;
        settings.updated_by = req.user?.id || null;
        await settings.save();

        console.log("✅ Logo muvaffaqiyatli saqlandi");

        res.status(200).json({
          success: true,
          message: "Logo muvaffaqiyatli yuklandi",
          data: {
            logo: optimizedLogo,
            originalName: req.file.originalname,
            size: req.file.size,
          },
        });
      } catch (processError) {
        console.error("❌ Logo qayta ishlashda xatolik:", processError);
        res.status(500).json({
          success: false,
          message: "Logo qayta ishlashda xatolik",
          error: processError.message,
        });
      }
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

// 🗑️ Logo o'chirish
const deleteLogo = async (req, res) => {
  try {
    console.log("🗑️ Logo o'chirilmoqda...");

    const settings = await Settings.findOne({ is_active: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    settings.logo = null;
    settings.updated_by = req.user?.id || null;
    await settings.save();

    console.log("✅ Logo muvaffaqiyatli o'chirildi");

    res.status(200).json({
      success: true,
      message: "Logo muvaffaqiyatli o'chirildi",
      data: settings,
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

// 🔄 Default sozlamalarga qaytarish
const resetToDefault = async (req, res) => {
  try {
    console.log("🔄 Sozlamalar default holatiga qaytarilmoqda...");

    const defaultSettings = Settings.getDefaultSettings();

    let settings = await Settings.findOne({ is_active: true });
    if (!settings) {
      settings = await Settings.create({
        ...defaultSettings,
        created_by: req.user?.id || null,
      });
    } else {
      Object.keys(defaultSettings).forEach((key) => {
        if (key === "theme" || key === "social_media") {
          settings[key] = defaultSettings[key];
        } else {
          settings[key] = defaultSettings[key];
        }
      });
      settings.updated_by = req.user?.id || null;
      await settings.save();
    }

    console.log("✅ Sozlamalar default holatiga qaytarildi");

    res.status(200).json({
      success: true,
      message: "Sozlamalar default holatiga qaytarildi",
      data: settings,
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

// 🧪 Test chek yaratish
const generateTestReceipt = async (req, res) => {
  try {
    console.log("🧪 Test chek yaratilmoqda...");

    const settings = await Settings.findOrCreate();

    // Test ma'lumotlari
    const testData = {
      table_number: "A1",
      waiter_name: "Test Afitsant",
      items: [
        { name: "Чай черный с лимоном", quantity: 2, price: 15000 },
        { name: "Круассан с шоколадом", quantity: 1, price: 25000 },
        { name: "Капучино", quantity: 1, price: 18000 },
      ],
      date: new Date().toLocaleString("uz-UZ"),
      order_id: "TEST_" + Date.now(),
    };

    // Summalarni hisoblash
    const subtotal = testData.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const service = Math.round(
      (subtotal * (settings.service_percent || 10)) / 100
    );
    const tax = Math.round((subtotal * (settings.tax_percent || 12)) / 100);
    const total = subtotal + service + tax;

    const receiptData = {
      ...testData,
      settings: settings.toJSON(),
      totals: {
        subtotal,
        service,
        tax,
        total,
      },
    };

    console.log("✅ Test chek ma'lumotlari tayyorlandi");

    res.status(200).json({
      success: true,
      message: "Test chek ma'lumotlari tayyor",
      data: receiptData,
    });
  } catch (error) {
    console.error("❌ Test chek yaratishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Test chek yaratishda xatolik",
      error: error.message,
    });
  }
};

// 📊 Sozlamalar statistikasi
const getSettingsInfo = async (req, res) => {
  try {
    const settings = await Settings.findOne({ is_active: true });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Sozlamalar topilmadi",
      });
    }

    const info = {
      id: settings._id,
      restaurant_name: settings.restaurant_name,
      created_at: settings.createdAt,
      updated_at: settings.updatedAt,
      has_logo: !!settings.logo,
      language: settings.language,
      currency: settings.currency,
      is_configured: !!(
        settings.restaurant_name &&
        settings.phone &&
        settings.address
      ),
    };

    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    console.error("❌ Sozlamalar info olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Sozlamalar info olishda xatolik",
      error: error.message,
    });
  }
};

// ✅ TO'LIQ EXPORT (asosiy muammo shu yerda edi!)
module.exports = {
  getSettings, // ← Bu yo'q edi!
  createSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  resetToDefault,
  generateTestReceipt,
  getSettingsInfo,
};
