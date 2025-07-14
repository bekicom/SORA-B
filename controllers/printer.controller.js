const Printer = require("../models/Printer");
const escpos = require("escpos");
escpos.Network = require("escpos-network");

// 🔧 IP manzil validatsiyasi
const validateIP = (ip) => {
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// 🖨️ Printer ulanishini tekshirish
const testPrinterConnection = (ip) => {
  return new Promise((resolve, reject) => {
    const device = new escpos.Network(ip);

    const timeout = setTimeout(() => {
      reject(new Error("Printer javob bermadi (timeout)"));
    }, 3000);

    device.open((error) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
      } else {
        device.close();
        resolve(true);
      }
    });
  });
};

// ➕ Yangi printer qo'shish
exports.createPrinter = async (req, res) => {
  try {
    const { name, ip, description } = req.body;

    // Validatsiya
    if (!name || !ip) {
      return res.status(400).json({
        message: "Majburiy maydonlar to'ldirilmagan",
        required: ["name", "ip", "location"],
      });
    }

    // IP manzil validatsiyasi
    if (!validateIP(ip)) {
      return res.status(400).json({
        message: "IP manzil noto'g'ri formatda",
        example: "192.168.0.100",
      });
    }

    // Takrorlanish tekshiruvi
    const existingPrinter = await Printer.findOne({
      $or: [{ ip }, { name }],
    });

    if (existingPrinter) {
      return res.status(409).json({
        message:
          existingPrinter.ip === ip
            ? "Bu IP manzil allaqachon ishlatilgan"
            : "Bu nom allaqachon ishlatilgan",
      });
    }

    // Printer ulanishini tekshirish
    let connectionStatus = "offline";
    try {
      await testPrinterConnection(ip);
      connectionStatus = "online";
    } catch (error) {
      console.warn(`⚠️ Printer ${ip} ulanmadi:`, error.message);
    }

    const printer = await Printer.create({
      name,
      ip,

      description,
      status: connectionStatus,
      lastChecked: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Printer muvaffaqiyatli qo'shildi",
      printer,
      connectionStatus,
    });
  } catch (error) {
    console.error("Printer yaratishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Printer yaratilmadi",
      error: error.message,
    });
  }
};

// 📋 Barcha printerlarni olish
exports.getPrinters = async (req, res) => {
  try {
    const printers = await Printer.find().sort({ createdAt: -1 });

    // Har bir printer uchun holat ma'lumotini qo'shish
    const printersWithStatus = await Promise.all(
      printers.map(async (printer) => {
        let currentStatus = "offline";
        try {
          await testPrinterConnection(printer.ip);
          currentStatus = "online";
        } catch (error) {
          // Offline bo'lsa, xatolik logini yozmaydi
        }

        // Holatni yangilash
        if (printer.status !== currentStatus) {
          await Printer.findByIdAndUpdate(printer._id, {
            status: currentStatus,
            lastChecked: new Date(),
          });
        }

        return {
          ...printer.toObject(),
          status: currentStatus,
          lastChecked: new Date(),
        };
      })
    );

    res.status(200).json({
      success: true,
      count: printers.length,
      printers: printersWithStatus,
    });
  } catch (error) {
    console.error("Printerlarni olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Printerlar olinmadi",
      error: error.message,
    });
  }
};

// 📝 Printerni yangilash
exports.updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip, location, description } = req.body;

    // Printer mavjudligini tekshirish
    const printer = await Printer.findById(id);
    if (!printer) {
      return res.status(404).json({
        success: false,
        message: "Printer topilmadi",
      });
    }

    // IP o'zgargan bo'lsa validatsiya
    if (ip && ip !== printer.ip) {
      if (!validateIP(ip)) {
        return res.status(400).json({
          success: false,
          message: "IP manzil noto'g'ri formatda",
        });
      }

      // Boshqa printerda bu IP ishlatilgan yoki yo'qligini tekshirish
      const existingIP = await Printer.findOne({
        ip,
        _id: { $ne: id },
      });

      if (existingIP) {
        return res.status(409).json({
          success: false,
          message: "Bu IP manzil boshqa printerda ishlatilgan",
        });
      }
    }

    // Yangi ulanishni tekshirish
    let connectionStatus = "offline";
    if (ip) {
      try {
        await testPrinterConnection(ip);
        connectionStatus = "online";
      } catch (error) {
        console.warn(`⚠️ Yangilangan printer ${ip} ulanmadi:`, error.message);
      }
    }

    const updateData = {
      ...(name && { name }),
      ...(ip && { ip }),

      ...(description && { description }),
      status: connectionStatus,
      lastChecked: new Date(),
    };

    const updated = await Printer.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Printer muvaffaqiyatli yangilandi",
      printer: updated,
    });
  } catch (error) {
    console.error("Printerni yangilashda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Yangilab bo'lmadi",
      error: error.message,
    });
  }
};

// ❌ Printerni o'chirish
exports.deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;

    const printer = await Printer.findById(id);
    if (!printer) {
      return res.status(404).json({
        success: false,
        message: "Printer topilmadi",
      });
    }

    await Printer.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Printer muvaffaqiyatli o'chirildi",
      deletedPrinter: printer,
    });
  } catch (error) {
    console.error("Printer o'chirishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "O'chirishda xatolik",
      error: error.message,
    });
  }
};

// 🔍 Bitta printerni olish
exports.getPrinterById = async (req, res) => {
  try {
    const { id } = req.params;
    const printer = await Printer.findById(id);

    if (!printer) {
      return res.status(404).json({
        success: false,
        message: "Printer topilmadi",
      });
    }

    // Ulanish holatini tekshirish
    let connectionStatus = "offline";
    try {
      await testPrinterConnection(printer.ip);
      connectionStatus = "online";
    } catch (error) {
      // Offline
    }

    // Holatni yangilash
    await Printer.findByIdAndUpdate(id, {
      status: connectionStatus,
      lastChecked: new Date(),
    });

    res.status(200).json({
      success: true,
      printer: {
        ...printer.toObject(),
        status: connectionStatus,
        lastChecked: new Date(),
      },
    });
  } catch (error) {
    console.error("Printer olishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Printer olinmadi",
      error: error.message,
    });
  }
};

// 🖨️ Printer ulanishini tekshirish
exports.testPrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const printer = await Printer.findById(id);

    if (!printer) {
      return res.status(404).json({
        success: false,
        message: "Printer topilmadi",
      });
    }

    try {
      await testPrinterConnection(printer.ip);

      // Holatni yangilash
      await Printer.findByIdAndUpdate(id, {
        status: "online",
        lastChecked: new Date(),
      });

      res.status(200).json({
        success: true,
        message: "Printer muvaffaqiyatli ulanmoqda",
        printer: printer.name,
        ip: printer.ip,
        status: "online",
      });
    } catch (error) {
      // Holatni yangilash
      await Printer.findByIdAndUpdate(id, {
        status: "offline",
        lastChecked: new Date(),
      });

      res.status(503).json({
        success: false,
        message: "Printer ulanmadi",
        printer: printer.name,
        ip: printer.ip,
        status: "offline",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Printer test qilishda xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Test amalga oshirilmadi",
      error: error.message,
    });
  }
};

// 🖨️ Test chek chop etish
exports.printTestReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const printer = await Printer.findById(id);

    if (!printer) {
      return res.status(404).json({
        success: false,
        message: "Printer topilmadi",
      });
    }

    const device = new escpos.Network(printer.ip);
    const printerDevice = new escpos.Printer(device);

    await new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        printerDevice
          .encode("UTF-8")
          .align("CT")
          .size(2, 2)
          .text("TEST CHEK")
          .drawLine()
          .size(1, 1)
          .align("LT")
          .text(`Printer: ${printer.name}`)
          .text(`IP: ${printer.ip}`)

          .text(`Sana: ${new Date().toLocaleString("uz-UZ")}`)
          .drawLine()
          .align("CT")
          .text("Printer muvaffaqiyatli ishlayapti!")
          .cut()
          .close(() => {
            resolve();
          });
      });
    });

    // Holatni yangilash
    await Printer.findByIdAndUpdate(id, {
      status: "online",
      lastChecked: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Test chek muvaffaqiyatli chop etildi",
      printer: printer.name,
    });
  } catch (error) {
    console.error("Test chek chop etishda xatolik:", error);

    // Holatni yangilash
    await Printer.findByIdAndUpdate(id, {
      status: "offline",
      lastChecked: new Date(),
    });

    res.status(500).json({
      success: false,
      message: "Test chek chop etilmadi",
      error: error.message,
    });
  }
};
