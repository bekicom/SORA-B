// models/Settings.js
const mongoose = require("mongoose");

// Agar model allaqachon mavjud bo'lsa, uni qaytarish
if (mongoose.models.Settings) {
  module.exports = mongoose.models.Settings;
} else {
  const settingsSchema = new mongoose.Schema(
    {
      // 🏪 Restoran asosiy ma'lumotlari
      restaurant_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default: "SORA RESTAURANT",
      },

      address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
        default: "Toshkent sh., Yunusobod tumani",
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        default: "+998 90 123 45 67",
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },

      website: {
        type: String,
        trim: true,
        default: "",
      },

      // 🎨 Logo sozlamalari
      logo: {
        type: String, // Base64 string
        default: null,
      },

      // 📝 Chek sozlamalari
      font_size: {
        type: Number,
        min: 8,
        max: 24,
        default: 14,
      },

      font_family: {
        type: String,
        enum: [
          "Arial",
          "Times New Roman",
          "Courier New",
          "Georgia",
          "Verdana",
          "Roboto",
        ],
        default: "Arial",
      },

      text_color: {
        type: String,
        match: /^#[0-9A-Fa-f]{6}$/,
        default: "#000000",
      },

      // 💰 Moliyaviy sozlamalar
      currency: {
        type: String,
        enum: ["UZS", "USD", "EUR"],
        default: "UZS",
      },

      tax_percent: {
        type: Number,
        min: 0,
        max: 50,
        default: 12,
      },

      service_percent: {
        type: Number,
        min: 0,
        max: 50,
        default: 10,
      },

      // 🔧 Display sozlamalar
      show_qr: {
        type: Boolean,
        default: true,
      },

      show_deposit: {
        type: Boolean,
        default: true,
      },

      show_logo: {
        type: Boolean,
        default: true,
      },

      // 📄 Matn sozlamalari
      footer_text: {
        type: String,
        maxlength: 500,
        default: "Приходите еще!",
      },

      thank_you_text: {
        type: String,
        maxlength: 200,
        default: "Спасибо за посещение!",
      },

      additional_text: {
        type: String,
        maxlength: 300,
        default: "Ваше мнение важно для нас",
      },

      deposit_text: {
        type: String,
        maxlength: 200,
        default: "Ваш депозит\\nРесторан:",
      },

      // 🌐 Til sozlamalari
      language: {
        type: String,
        enum: ["uz", "ru", "en"],
        default: "ru",
      },

      // 🎛️ Qo'shimcha sozlamalar
      receipt_width: {
        type: Number,
        min: 200,
        max: 400,
        default: 300,
      },

      auto_print: {
        type: Boolean,
        default: true,
      },

      print_copies: {
        type: Number,
        min: 1,
        max: 5,
        default: 1,
      },

      // 📊 QR kod sozlamalari
      qr_code_size: {
        type: Number,
        min: 50,
        max: 200,
        default: 100,
      },

      qr_code_content: {
        type: String,
        maxlength: 500,
        default: "https://example.com/review",
      },

      // 🏢 Kompaniya ma'lumotlari
      tax_number: {
        type: String,
        trim: true,
        default: "",
      },

      license_number: {
        type: String,
        trim: true,
        default: "",
      },

      // 🎨 Theme sozlamalari
      theme: {
        primary_color: {
          type: String,
          match: /^#[0-9A-Fa-f]{6}$/,
          default: "#1890ff",
        },
        secondary_color: {
          type: String,
          match: /^#[0-9A-Fa-f]{6}$/,
          default: "#722ed1",
        },
        background_color: {
          type: String,
          match: /^#[0-9A-Fa-f]{6}$/,
          default: "#ffffff",
        },
      },

      // 📱 Ijtimoiy tarmoqlar
      social_media: {
        telegram: {
          type: String,
          default: "",
        },
        instagram: {
          type: String,
          default: "",
        },
        facebook: {
          type: String,
          default: "",
        },
      },

      // 🔐 Sistema maydonlari
      is_active: {
        type: Boolean,
        default: true,
      },

      created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

  // 📊 Indexlar
  settingsSchema.index({ is_active: 1 });
  settingsSchema.index({ createdAt: -1 });

  // 🛡️ Pre-save middleware
  settingsSchema.pre("save", function (next) {
    // Phone nomerni tozalash
    if (this.phone) {
      this.phone = this.phone.replace(/\s/g, "");
      if (!this.phone.startsWith("+998") && this.phone.length === 9) {
        this.phone = "+998" + this.phone;
      }
    }

    next();
  });

  // 📤 JSON response uchun transformation
  settingsSchema.methods.toJSON = function () {
    const settingsObject = this.toObject();

    // Logo preview (agar juda katta bo'lsa)
    if (settingsObject.logo && settingsObject.logo.length > 1000) {
      settingsObject.has_logo = true;
    }

    return settingsObject;
  };

  // 🔧 Static metodlar
  settingsSchema.statics.getDefaultSettings = function () {
    return {
      restaurant_name: "SORA RESTAURANT",
      address: "Toshkent sh., Yunusobod tumani",
      phone: "+998 90 123 45 67",
      email: "",
      website: "",
      logo: null,
      font_size: 14,
      font_family: "Arial",
      text_color: "#000000",
      currency: "UZS",
      tax_percent: 12,
      service_percent: 10,
      show_qr: true,
      show_deposit: true,
      show_logo: true,
      footer_text: "Приходите еще!",
      thank_you_text: "Спасибо за посещение!",
      additional_text: "Ваше мнение важно для нас",
      deposit_text: "Ваш депозит\\nРесторан:",
      language: "ru",
      theme: {
        primary_color: "#1890ff",
        secondary_color: "#722ed1",
        background_color: "#ffffff",
      },
      social_media: {
        telegram: "",
        instagram: "",
        facebook: "",
      },
    };
  };

  settingsSchema.statics.findOrCreate = async function () {
    let settings = await this.findOne({ is_active: true });

    if (!settings) {
      const defaultSettings = this.getDefaultSettings();
      settings = await this.create(defaultSettings);
      console.log("✅ Default settings yaratildi");
    }

    return settings;
  };

  // Model yaratish
  const Settings = mongoose.model("Settings", settingsSchema);
  module.exports = Settings;
}
