const net = require("net");

function initPrinterServer(app) {
  // ✅ Oshxona printeri (ESC/POS - o'zgarishsiz)
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

        printer
          .encode("UTF-8")
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
            const name = item.name || "Nomaʼlum";
            const qty = item.quantity || 1;
            printer
              .size(1, 2)
              .text(`${name}`)
              .size(1, 1)
              .text(`   Miqdor: x ${qty} `)
              .text("-----------------");
          });
        }

        printer.text("").align("CT").cut().close();
        return res.json({ message: "✅ Oshxona printeriga yuborildi!" });
      });
    } catch (err) {
      console.error("❌ Print xatosi:", err.message);
      res.status(500).json({ message: "❌ Chekni yuborishda xatolik" });
    }
  });

  // ✅ KASSIR CHEKI: Raw Socket (frontend format)
  app.post("/print-check", async (req, res) => {
    try {
      const receiptData = req.body;

      console.log("🧾 Raw Socket kassir cheki:", {
        restaurant_name: receiptData.restaurant_name,
        order_number:
          receiptData.order_number || receiptData.formatted_order_number,
        kassir_printer_ip: receiptData.kassir_printer_ip,
        total_amount: receiptData.total_amount,
      });

      const printerIP = receiptData.kassir_printer_ip || "192.168.0.106";
      const printerPort = 9100;

      // ✅ Raw text content yaratish (frontend format)
      const rawContent = generateRawReceiptContent(receiptData);

      // ✅ Direct socket connection
      const client = new net.Socket();

      client.connect(printerPort, printerIP, () => {
        console.log(`✅ Raw socket ulanildi: ${printerIP}:${printerPort}`);

        // Raw content yuborish
        client.write(rawContent);
        client.end();

        res.json({
          message: "✅ Raw socket orqali chiqarildi!",
          method: "raw_socket",
          printer_ip: printerIP,
          order_number:
            receiptData.order_number || receiptData.formatted_order_number,
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

// ✅ Raw content generator (PROFESSIONAL 58mm format - 2-chi rasmdagi kabi)
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

  // ✅ ESC/POS komandalar
  const ESC = "\x1B";
  const ALIGN_CENTER = ESC + "a1";
  const ALIGN_LEFT = ESC + "a0";
  const ALIGN_RIGHT = ESC + "a2";
  const BOLD_ON = ESC + "E1";
  const BOLD_OFF = ESC + "E0";
  const SIZE_NORMAL = ESC + "!0";
  const SIZE_DOUBLE = ESC + "!1";
  const CUT = ESC + "d3" + ESC + "i";
  const INIT = ESC + "@";

  let content = "";

  // ✅ Initialize printer
  content += INIT;

  // ✅ PROFESSIONAL Header (2-chi rasmdagi kabi)
  content += ALIGN_CENTER + SIZE_DOUBLE + BOLD_ON;
  content += restaurant_name + "\n";
  content += SIZE_NORMAL + BOLD_OFF;
  content += phone + "\n";
  content += address + "\n";
  if (website) content += website + "\n";
  content += "\n";

  // ✅ Order info (2-chi rasmdagi kabi format)
  content += ALIGN_LEFT;
  content += `Zakaz: ${order_number}\n`;
  content += `Vaqt: ${date}\n`;
  content += `Ofitsiant: ${waiter_name}\n`;
  content += `Stol: ${table_display}\n`;
  content += `Gostey: ${guests}\n`;
  content += "\n";

  // ✅ Items section (2-chi rasmdagi kabi professional table)
  content += "Bludo    Kol    Summa\n";
  content += "--------\n";

  // ✅ Items list (2-chi rasmdagi kabi spacing)
  items.forEach((item) => {
    const name = (item.name || "Unknown").substring(0, 20).padEnd(20);
    const qty = (item.quantity || 1).toString().padStart(3);
    const price = formatPriceNormal(item.price || 0).padStart(8);
    content += `${name} ${qty}  ${price}\n`;
  });

  content += "\n";

  // ✅ Totals section (2-chi rasmdagi kabi professional)
  content += ALIGN_LEFT;
  content += `Summa:                ${formatPriceNormal(subtotal)}.00\n`;
  content += `Obsluzhivanie (${service_percent}%):     ${formatPriceNormal(
    service_amount
  )}.00\n`;

  content += "--------\n";
  content +=
    BOLD_ON +
    `ITOGO:            ${formatPriceNormal(total_amount)}.00\n` +
    BOLD_OFF;
  content += "\n";

  // ✅ QR code (2-chi rasmdagi kabi)
  if (show_qr) {
    content += ALIGN_CENTER;
    content += "[QR KOD]\n";
    content += "\n";
  }

  // ✅ Footer (2-chi rasmdagi kabi professional)
  content += ALIGN_CENTER;
  if (footer_text) {
    const footerLines = footer_text.split("\n");
    footerLines.forEach((line) => {
      content += line + "\n";
    });
  }


  // ✅ Cut paper
  content += CUT;

  return content;
}

// ✅ Professional price formatting (2-chi rasmdagi kabi)
function formatPriceNormal(price) {
  if (price >= 1000) {
    return (
      Math.floor(price / 1000) + " " + String(price % 1000).padStart(3, "0")
    );
  } else {
    return price.toString();
  }
}

module.exports = initPrinterServer;
