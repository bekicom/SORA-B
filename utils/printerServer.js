const net = require("net");

// ✅ PROFESSIONAL RESTORAN CHEKI generator
function initPrinterServer(app) {
  // ✅ Oshxona printeri (ESC/POS - kirill harf muammosi hal qilingan)
  app.post("/print", async (req, res) => {
    try {
      const { items, table_number, waiter_name, date } = req.body;
      const printerIp = req.body.printerIp || "192.168.0.106";

      const escpos = require("escpos");
      escpos.Network = require("escpos-network");
      const device = new escpos.Network(printerIp, 9100);
      const printer = new escpos.Printer(device);

      device.open(function (err) {
        if (err) {
          console.error("❌ Printerga ulanib bo'lmadi:", err.message);
          return res
            .status(400)
            .json({ message: "❌ Printerga ulanishda xatolik" });
        }

        // ✅ TUZATILDI: Kirill uchun to'g'ri charset
        printer
          .encode("CP866") // ✅ Kirill alifbosi uchun CP866 kodlash
          .align("CT")
          .size(2, 2)
          .text(" ZAKAZ CHEKI")
          .size(1, 1)
          .text("-----------------")
          .align("LT")
          .text(`: ${date || new Date().toLocaleString("uz-UZ")}`)
          .text("-----------------")
          .text(`STOL: ${table_number || "Nomaʼlum"}`)
          .text("-----------------")
          .text(`OFITSIANT: ${waiter_name || "Nomaʼlum"}`)
          .text("-----------------");

        if (items && items.length > 0) {
          items.forEach((item) => {
            // ✅ TUZATILDI: Taom nomini encoding tuzatish
            let itemName = item.name || "Nomaʼlum";
            itemName = fixTextEncoding(itemName);

            const qty = item.quantity || 1;
            printer
              .size(1, 2)
              .text(`${itemName}`)
              .size(1, 1)
              .text(`   Miqdor: x ${qty} `)
              .text("-----------------");

            console.log("🍽️ Kitchen item processed:", {
              originalName: item.name,
              fixedName: itemName,
            });
          });

          // ✅ Chekning oxirida bo'sh qatorlar chiqib, balandroq bo'lishi uchun
          printer.feed(10); // 10 ta bo'sh qator
        }

        printer.text("").align("CT").cut().close();
        return res.json({ message: "✅ Oshxona printeriga yuborildi!" });
      });
    } catch (err) {
      console.error("❌ Print xatosi:", err.message);
      res.status(500).json({ message: "❌ Chekni yuborishda xatolik" });
    }
  });

  // ✅ KASSIR CHEKI: Raw Socket (frontend format) - Kirill harf muammosi hal qilingan
  app.post("/print-check", async (req, res) => {
    try {
      // ✅ YANGI YONDASHUV: Ma'lumotlarni qabul qilishda debugging
      console.log("📨 Kelgan ma'lumotlar:", {
        body: JSON.stringify(req.body, null, 2),
        contentType: req.headers["content-type"],
        charset: req.headers["charset"],
      });

      const receiptData = req.body;

      console.log("🧾 Raw Socket kassir cheki:", {
        restaurant_name: receiptData.restaurant_name,
        order_number:
          receiptData.order_number || receiptData.formatted_order_number,
        kassir_printer_ip: receiptData.kassir_printer_ip,
        total_amount: receiptData.total_amount,
        service_percent: receiptData.service_percent,
        service_amount: receiptData.service_amount,
        subtotal: receiptData.subtotal,
        // ✅ Debug: items ma'lumotlari
        items: receiptData.items
          ? receiptData.items.map((item) => ({
              name: item.name,
              nameLength: item.name ? item.name.length : 0,
              hasChineseChars: item.name
                ? /[\u4e00-\u9fff]/.test(item.name)
                : false,
            }))
          : [],
      });

      const printerIP = receiptData.kassir_printer_ip || "192.168.0.106";
      const printerPort = 9100;

      // ✅ Raw text content yaratish (kirill uchun to'g'rilangan)
      const rawContent = generateRawReceiptContent(receiptData);

      // ✅ Direct socket connection
      const client = new net.Socket();

      client.connect(printerPort, printerIP, () => {
        console.log(`✅ Raw socket ulanildi: ${printerIP}:${printerPort}`);

        // ✅ TUZATILDI: Kirill harf uchun to'g'ri encoding bilan yuborish
        client.write(rawContent, "binary"); // Binary rejimda yuborish
        client.end();

        res.json({
          message: "✅ Raw socket orqali chiqarildi!",
          method: "raw_socket",
          printer_ip: printerIP,
          order_number:
            receiptData.order_number || receiptData.formatted_order_number,
          debug: {
            service_percent: receiptData.service_percent,
            service_amount: receiptData.service_amount,
            subtotal: receiptData.subtotal,
            total_amount: receiptData.total_amount,
          },
        });
      });

      client.on("error", (err) => {
        console.error("❌ Raw socket xatosi:", err.message);
        res.status(500).json({
          message: "❌ Raw socket xatosi",
          error: err.message,
          printer_ip: printerIP,
        });
      });

      client.on("close", () => {
        console.log(`✅ Raw socket ulanish yopildi: ${printerIP}`);
      });
    } catch (err) {
      console.error("❌ Raw socket service xatosi:", err.message);
      res.status(500).json({
        message: "❌ Raw socket service xatosi",
        error: err.message,
      });
    }
  });
}

// ✅ TUZATILDI: Matn encoding muammosini hal qiluvchi funksiya
function convertToCp866(str) {
  if (!str) return "";

  try {
    // ✅ Agar matn Buffer yoki noto'g'ri encoded bo'lsa, uni to'g'rilaymiz
    let cleanStr = str;

    // Buffer dan string ga aylantirish
    if (Buffer.isBuffer(str)) {
      cleanStr = str.toString("utf8");
    }

    // Noto'g'ri encoding ni aniqlash va tuzatish
    if (typeof cleanStr === "string") {
      // Agar matnda xitoycha yoki boshqa noto'g'ri belgilar bo'lsa
      // UTF-8 dan latin1 ga qayta dekodlash
      try {
        const bytes = Buffer.from(cleanStr, "latin1");
        cleanStr = bytes.toString("utf8");
      } catch (e) {
        // Agar xatolik bo'lsa, asl matnni qoldirish
        console.log("Encoding conversion error:", e.message);
      }
    }

    console.log("🔤 Text conversion:", {
      original: str,
      cleaned: cleanStr,
      originalLength: str.length,
      cleanedLength: cleanStr.length,
    });

    // CP866 (DOS Cyrillic) charset mapping
    const cp866Map = {
      А: "\x80",
      Б: "\x81",
      В: "\x82",
      Г: "\x83",
      Д: "\x84",
      Е: "\x85",
      Ж: "\x86",
      З: "\x87",
      И: "\x88",
      Й: "\x89",
      К: "\x8A",
      Л: "\x8B",
      М: "\x8C",
      Н: "\x8D",
      О: "\x8E",
      П: "\x8F",
      Р: "\x90",
      С: "\x91",
      Т: "\x92",
      У: "\x93",
      Ф: "\x94",
      Х: "\x95",
      Ц: "\x96",
      Ч: "\x97",
      Ш: "\x98",
      Щ: "\x99",
      Ъ: "\x9A",
      Ы: "\x9B",
      Ь: "\x9C",
      Э: "\x9D",
      Ю: "\x9E",
      Я: "\x9F",
      а: "\xA0",
      б: "\xA1",
      в: "\xA2",
      г: "\xA3",
      д: "\xA4",
      е: "\xA5",
      ж: "\xA6",
      з: "\xA7",
      и: "\xA8",
      й: "\xA9",
      к: "\xAA",
      л: "\xAB",
      м: "\xAC",
      н: "\xAD",
      о: "\xAE",
      п: "\xAF",
      р: "\xE0",
      с: "\xE1",
      т: "\xE2",
      у: "\xE3",
      ф: "\xE4",
      х: "\xE5",
      ц: "\xE6",
      ч: "\xE7",
      ш: "\xE8",
      щ: "\xE9",
      ъ: "\xEA",
      ы: "\xEB",
      ь: "\xEC",
      э: "\xED",
      ю: "\xEE",
      я: "\xEF",
      // O'zbek tilining maxsus harflari
      Ў: "\x9A",
      ў: "\xEA",
      Қ: "\x8A",
      қ: "\xAA",
      Ғ: "\x83",
      ғ: "\xA3",
      Ҳ: "\x95",
      ҳ: "\xE5",
      Ҷ: "\x97",
      ҷ: "\xE7",
      Ӣ: "\x88",
      ӣ: "\xA8",
      Ӯ: "\x93",
      ӯ: "\xE3",
    };

    let result = "";
    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr[i];
      if (cp866Map[char]) {
        result += cp866Map[char];
      } else {
        result += char; // ASCII harflar o'zgarishsiz qoladi
      }
    }
    return result;
  } catch (error) {
    console.error("❌ Convert to CP866 error:", error.message);
    return str; // Xatolikda asl matnni qaytarish
  }
}

// ✅ KUCHLI ENCODING TUZATISH - barcha mumkin bo'lgan usullar
function fixTextEncoding(text) {
  if (!text) return text;

  try {
    console.log("🔍 Original text analysis:", {
      text: text,
      length: text.length,
      charCodes: Array.from(text).map((c) => c.charCodeAt(0)),
      hasChineseChars: /[\u4e00-\u9fff]/.test(text),
      hasHighBytes: /[\u0080-\uffff]/.test(text),
    });

    // Agar matnda xitoycha belgilar bo'lsa
    if (/[\u4e00-\u9fff]/.test(text)) {
      console.log(
        "🔧 Xitoycha belgilar aniqlandi, har xil usul sinab ko'rilmoqda..."
      );

      // Usul 1: UTF-8 -> Latin1 -> UTF-8
      try {
        const method1 = Buffer.from(text, "utf8").toString("latin1");
        console.log("🔤 Method 1 (UTF8->Latin1):", method1);
        if (!/[\u4e00-\u9fff]/.test(method1)) {
          return method1;
        }
      } catch (e) {
        console.log("Method 1 failed:", e.message);
      }

      // Usul 2: Double encoding tuzatish
      try {
        const method2 = Buffer.from(
          Buffer.from(text, "utf8").toString("binary"),
          "binary"
        ).toString("utf8");
        console.log("🔤 Method 2 (Double decode):", method2);
        if (!/[\u4e00-\u9fff]/.test(method2)) {
          return method2;
        }
      } catch (e) {
        console.log("Method 2 failed:", e.message);
      }

      // Usul 3: Iconv-lite ishlatish (agar mavjud bo'lsa)
      try {
        const iconv = require("iconv-lite");
        const method3 = iconv.decode(Buffer.from(text, "utf8"), "cp1251");
        console.log("🔤 Method 3 (Iconv CP1251):", method3);
        if (!/[\u4e00-\u9fff]/.test(method3)) {
          return method3;
        }
      } catch (e) {
        console.log("Method 3 failed (iconv not available):", e.message);
      }

      // Usul 4: Windows-1251 manually decode
      try {
        const method4 = decodeWindows1251(text);
        console.log("🔤 Method 4 (Manual Win1251):", method4);
        if (!/[\u4e00-\u9fff]/.test(method4)) {
          return method4;
        }
      } catch (e) {
        console.log("Method 4 failed:", e.message);
      }

      // Agar hech qaysi usul ishlamasa, asl matnni qaytarish
      console.log("⚠️ Barcha usullar muvaffaqiyatsiz, asl matn qaytarilmoqda");
    }

    return text;
  } catch (error) {
    console.error("❌ Fix encoding error:", error.message);
    return text;
  }
}

// ✅ Windows-1251 manual decoder
function decodeWindows1251(text) {
  const win1251Map = {
    0x2013: 0x96, // EN DASH
    0x2014: 0x97, // EM DASH
    0x2018: 0x91, // LEFT SINGLE QUOTATION MARK
    0x2019: 0x92, // RIGHT SINGLE QUOTATION MARK
    0x201a: 0x82, // SINGLE LOW-9 QUOTATION MARK
    0x201c: 0x93, // LEFT DOUBLE QUOTATION MARK
    0x201d: 0x94, // RIGHT DOUBLE QUOTATION MARK
    0x201e: 0x84, // DOUBLE LOW-9 QUOTATION MARK
    0x2020: 0x86, // DAGGER
    0x2021: 0x87, // DOUBLE DAGGER
    0x2022: 0x95, // BULLET
    0x2026: 0x85, // HORIZONTAL ELLIPSIS
    0x2030: 0x89, // PER MILLE SIGN
    0x2039: 0x8b, // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    0x203a: 0x9b, // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    0x20ac: 0x88, // EURO SIGN
    0x2116: 0xb9, // NUMERO SIGN
    0x0402: 0x80, // CYRILLIC CAPITAL LETTER DJE
    0x0403: 0x81, // CYRILLIC CAPITAL LETTER GJE
    0x201a: 0x82, // SINGLE LOW-9 QUOTATION MARK
    0x0453: 0x83, // CYRILLIC SMALL LETTER GJE
    // Kirill harflari
    0x0410: 0xc0, // А
    0x0411: 0xc1, // Б
    0x0412: 0xc2, // В
    0x0413: 0xc3, // Г
    0x0414: 0xc4, // Д
    0x0415: 0xc5, // Е
    0x0416: 0xc6, // Ж
    0x0417: 0xc7, // З
    0x0418: 0xc8, // И
    0x0419: 0xc9, // Й
    0x041a: 0xca, // К
    0x041b: 0xcb, // Л
    0x041c: 0xcc, // М
    0x041d: 0xcd, // Н
    0x041e: 0xce, // О
    0x041f: 0xcf, // П
    0x0420: 0xd0, // Р
    0x0421: 0xd1, // С
    0x0422: 0xd2, // Т
    0x0423: 0xd3, // У
    0x0424: 0xd4, // Ф
    0x0425: 0xd5, // Х
    0x0426: 0xd6, // Ц
    0x0427: 0xd7, // Ч
    0x0428: 0xd8, // Ш
    0x0429: 0xd9, // Щ
    0x042a: 0xda, // Ъ
    0x042b: 0xdb, // Ы
    0x042c: 0xdc, // Ь
    0x042d: 0xdd, // Э
    0x042e: 0xde, // Ю
    0x042f: 0xdf, // Я
    0x0430: 0xe0, // а
    0x0431: 0xe1, // б
    0x0432: 0xe2, // в
    0x0433: 0xe3, // г
    0x0434: 0xe4, // д
    0x0435: 0xe5, // е
    0x0436: 0xe6, // ж
    0x0437: 0xe7, // з
    0x0438: 0xe8, // и
    0x0439: 0xe9, // й
    0x043a: 0xea, // к
    0x043b: 0xeb, // л
    0x043c: 0xec, // м
    0x043d: 0xed, // н
    0x043e: 0xee, // о
    0x043f: 0xef, // п
    0x0440: 0xf0, // р
    0x0441: 0xf1, // с
    0x0442: 0xf2, // т
    0x0443: 0xf3, // у
    0x0444: 0xf4, // ф
    0x0445: 0xf5, // х
    0x0446: 0xf6, // ц
    0x0447: 0xf7, // ч
    0x0448: 0xf8, // ш
    0x0449: 0xf9, // щ
    0x044a: 0xfa, // ъ
    0x044b: 0xfb, // ы
    0x044c: 0xfc, // ь
    0x044d: 0xfd, // э
    0x044e: 0xfe, // ю
    0x044f: 0xff, // я
  };

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const mapped = Object.keys(win1251Map).find(
      (key) => parseInt(key) === charCode
    );
    if (mapped) {
      result += String.fromCharCode(win1251Map[mapped]);
    } else {
      result += text[i];
    }
  }

  return result;
}

function generateRawReceiptContent(data) {
  const {
    restaurant_name = "SORA",
    phone = "+998 90 123 45 67",
    address = "Toshkent sh., Yunusobod tumani",
    website = "",
    date = new Date().toLocaleString("uz-UZ"),
    waiter_name = "Natalya",
    table_display = "A1",
    guests = 2,
    items = [],
    subtotal = 0,
    service_percent = 10,
    service_amount = 0,
    tax_percent = 12,
    tax_amount = 0,
    total_amount = 0,
    currency = "UZS",
    footer_text = "RAHMAT! Yana tashrif buyuring!",
    show_qr = false,
    order_number = "#001",
  } = data;

  // ✅ Service calculation logic (unchanged)
  let actualServiceAmount = service_amount;
  let actualServicePercent = service_percent;

  console.log("🔍 Service calculation input:", {
    service_percent,
    service_amount,
    subtotal,
  });

  if (
    (!service_amount || service_amount === 0) &&
    service_percent > 0 &&
    subtotal > 0
  ) {
    actualServiceAmount = Math.round((subtotal * service_percent) / 100);
    console.log(
      `🔄 Service amount hisoblandi: ${subtotal} * ${service_percent}% = ${actualServiceAmount}`
    );
  }

  if (
    (!service_percent || service_percent === 0) &&
    service_amount > 0 &&
    subtotal > 0
  ) {
    actualServicePercent = Math.round((service_amount / subtotal) * 100);
    console.log(
      `🔄 Service percent hisoblandi: ${service_amount}/${subtotal} = ${actualServicePercent}%`
    );
  }

  if (
    (!service_percent || service_percent === 0) &&
    (!service_amount || service_amount === 0) &&
    subtotal > 0
  ) {
    actualServicePercent = 10;
    actualServiceAmount = Math.round((subtotal * 10) / 100);
    console.log(
      `⚠️ Default 10% ishlatildi: ${subtotal} * 10% = ${actualServiceAmount}`
    );
  }

  console.log("💰 Final service calculation:", {
    actualServicePercent,
    actualServiceAmount,
    willShowService: actualServiceAmount > 0,
  });

  // ✅ ESC/POS komandalar
  const ESC = "\x1B";
  const ALIGN_CENTER = ESC + "a1";
  const ALIGN_LEFT = ESC + "a0";
  const BOLD_ON = ESC + "E1";
  const BOLD_OFF = ESC + "E0";
  const SIZE_SMALL = ESC + "!1";
  const SIZE_NORMAL = ESC + "!0";
  const SIZE_LARGE = ESC + "!16";

  // ✅ TUZATILDI: CP866 charset selector
  const SET_CP866 = ESC + "t" + String.fromCharCode(17); // CP866 tanlaw

  const LINE_SPACING_TIGHT = ESC + "3" + String.fromCharCode(18);
  const CUT = ESC + "d3" + ESC + "i";
  const INIT = ESC + "@";

  let content = "";

  // ✅ Initialize + CP866 charset + tight spacing
  content += INIT;
  content += SET_CP866; // ✅ CP866 ni faollashtirish
  content += LINE_SPACING_TIGHT;

  // ✅ PROFESSIONAL Header (kirill harflar bilan)
  content += ALIGN_CENTER + SIZE_NORMAL + BOLD_ON;
  content += convertToCp866(restaurant_name) + "\n";
  content += SIZE_SMALL + BOLD_OFF;
  content += convertToCp866(phone) + "\n";
  content += convertToCp866(address) + "\n";
  if (website) content += convertToCp866(website) + "\n";
  content += "\n";

  // ✅ Separator line
  content += ALIGN_CENTER + "================================\n";

  // ✅ Order info (kirill harflar bilan)
  content += ALIGN_LEFT + SIZE_SMALL;
  content += "\n";
  content += convertToCp866(`Zakaz: ${order_number}`) + "\n";
  content += convertToCp866(`Vaqt: ${date}`) + "\n";
  content += "\n";
  content += convertToCp866(`Ofitsiant: ${waiter_name}`) + "\n";
  content += convertToCp866(`Stol: ${table_display}`) + "\n";
  content += "\n";
  content += "\n";

  // ✅ Items header (kirill harflar bilan)
  content += convertToCp866("Nomi        Soni   Summa") + "\n";
  content += "--------------------------------\n";

  // ✅ Items (encoding tuzatish bilan)
  if (items && items.length > 0) {
    items.forEach((item) => {
      // ✅ TUZATILDI: Taom nomini encoding tuzatish bilan
      let itemName = item.name || "Unknown";

      // Encoding muammosini tuzatish
      itemName = fixTextEncoding(itemName);

      const name = convertToCp866(itemName.substring(0, 9).padEnd(9));
      content += "\n";
      const qty = `${item.quantity || 1}x`.padStart(4);
      const price = formatPriceNormal(item.price * item.quantity || 0).padStart(
        10
      );
      content += `${name} ${qty} ${price}\n`;

      console.log("📋 Item processed:", {
        originalName: item.name,
        fixedName: itemName,
        convertedName: name,
      });
    });
  }

  content += "\n";
  content += "--------------------------------\n";

  // ✅ Totals (kirill harflar bilan)
  content += ALIGN_LEFT + SIZE_SMALL;
  if (subtotal > 0) {
    content +=
      convertToCp866(`Taomlar:              ${formatPriceNormal(subtotal)}`) +
      "\n";
  }
  content += "\n";

  // ✅ Service qatori (kirill harflar bilan)
  if (actualServiceAmount > 0) {
    content +=
      convertToCp866(
        `Ofitsiant xizmati (${actualServicePercent}%): ${formatPriceNormal(
          actualServiceAmount
        )}`
      ) + "\n";
    console.log(
      `✅ Service qatori qo'shildi: ${actualServicePercent}% = ${actualServiceAmount}`
    );
  } else {
    console.log(
      `⚠️ Service qatori qo'shilmadi: actualServiceAmount = ${actualServiceAmount}`
    );
  }

  if (tax_amount > 0) {
    content +=
      convertToCp866(
        `Soliq (${tax_percent}%):       ${formatPriceNormal(tax_amount)}`
      ) + "\n";
  }

  content += "================================\n";

  // ✅ TOTAL (bold and larger) - kirill harflar bilan
  const calculatedTotal = subtotal + actualServiceAmount + tax_amount;
  content += BOLD_ON + SIZE_NORMAL;
  content +=
    convertToCp866(`JAMI:           ${formatPriceNormal(calculatedTotal)}`) +
    "\n";
  content += BOLD_OFF + SIZE_SMALL;

  // ✅ Professional footer (kirill harflar bilan)
  content += ALIGN_CENTER;
  content += "\n";
  content += convertToCp866(footer_text) + "\n";
  content += "\n";

  // ✅ Cut paper
  content += CUT;

  console.log("✅ Receipt generation completed (kirill support added):", {
    contentLength: content.length,
    calculatedTotal,
    serviceIncluded: actualServiceAmount > 0,
    serviceAmount: actualServiceAmount,
    servicePercent: actualServicePercent,
    cyrillicSupport: true,
  });

  return content;
}

// ✅ Price formatting (unchanged)
function formatPriceNormal(price) {
  if (!price || price === 0) return "0";

  if (price >= 1000) {
    return (
      Math.floor(price / 1000) + " " + String(price % 1000).padStart(3, "0")
    );
  } else {
    return price.toString();
  }
}

module.exports = initPrinterServer;
