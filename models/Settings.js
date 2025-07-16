const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // Existing fields
    logo: String,
    restaurant_name: {
      type: String,
      default: "SORA RESTAURANT",
    },
    phone: {
      type: String,
      default: "+998 90 123 45 67",
    },
    address: {
      type: String,
      default: "Toshkent sh., Yunusobod tumani",
    },
    email: {
      type: String,
      default: "info@sora-restaurant.uz",
    },
    website: {
      type: String,
      default: "www.sora-restaurant.uz",
    },
    font_size: {
      type: Number,
      default: 14,
      min: 8,
      max: 24,
    },
    font_family: {
      type: String,
      default: "Arial",
    },
    text_color: {
      type: String,
      default: "#000000",
    },
    show_qr: {
      type: Boolean,
      default: true,
    },
    show_deposit: {
      type: Boolean,
      default: true,
    },
    currency: {
      type: String,
      default: "UZS",
      enum: ["UZS", "USD", "EUR"],
    },
    tax_percent: {
      type: Number,
      default: 12,
      min: 0,
      max: 50,
    },
    service_percent: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },
    footer_text: {
      type: String,
      default: "Rahmat! Yana tashrif buyuring!",
    },
    thank_you_text: {
      type: String,
      default: "Спасибо за посещение!",
    },
    additional_text: {
      type: String,
      default: "Ваше мнение важно для нас",
    },
    deposit_text: {
      type: String,
      default: "Ваш депозит\\nРесторан:",
    },
    language: {
      type: String,
      default: "ru",
      enum: ["uz", "ru", "en"],
    },

    // 🆕 KASSIR PRINTER FIELDS
    kassir_printer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Printer",
      default: null,
    },
    kassir_printer_ip: {
      type: String,
      default: "192.168.0.106", // ← Bu qatorni null dan "192.168.0.106" ga o'zgartiring
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/empty
          // IP address validation regex
          return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            v
          );
        },
        message: "Invalid IP address format",
      },
    },
    auto_print_receipt: {
      type: Boolean,
      default: true,
    },
    print_receipt_copies: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },

    // System fields
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🆕 PRE-SAVE MIDDLEWARE: Kassir printer IP ni sync qilish
settingsSchema.pre("save", async function (next) {
  // Agar kassir_printer_id o'zgargan bo'lsa, IP ni yangilash
  if (this.isModified("kassir_printer_id") && this.kassir_printer_id) {
    try {
      const Printer = mongoose.model("Printer");
      const printer = await Printer.findById(this.kassir_printer_id);

      if (printer) {
        this.kassir_printer_ip = printer.ip;
        console.log(`✅ Kassir printer IP yangilandi: ${printer.ip}`);
      } else {
        this.kassir_printer_id = null;
        this.kassir_printer_ip = null;
        console.warn("⚠️ Kassir printer topilmadi, IP tozalandi");
      }
    } catch (error) {
      console.error("❌ Kassir printer IP yangilashda xatolik:", error);
    }
  }

  // Agar kassir_printer_id null bo'lsa, IP ni ham null qilish
  if (!this.kassir_printer_id) {
    this.kassir_printer_ip = null;
  }

  next();
});

// 🆕 INSTANCE METHOD: Get kassir printer info
settingsSchema.methods.getKassirPrinterInfo = async function () {
  if (!this.kassir_printer_id) {
    return null;
  }

  try {
    const Printer = mongoose.model("Printer");
    const printer = await Printer.findById(this.kassir_printer_id);

    return printer
      ? {
          id: printer._id,
          name: printer.name,
          ip: printer.ip,
          status: printer.status || "offline",
        }
      : null;
  } catch (error) {
    console.error("❌ Kassir printer info olishda xatolik:", error);
    return null;
  }
};

// 🆕 STATIC METHOD: Get active settings with kassir printer
settingsSchema.statics.getActiveWithKassirPrinter = async function () {
  try {
    return await this.findOne({ is_active: true }).populate(
      "kassir_printer_id"
    );
  } catch (error) {
    console.error("❌ Settings with kassir printer olishda xatolik:", error);
    return null;
  }
};

// 🆕 INDEX: Faster queries
settingsSchema.index({ is_active: 1 });
settingsSchema.index({ kassir_printer_id: 1 });

module.exports = mongoose.model("Settings", settingsSchema);
