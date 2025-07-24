const net = require("net");

// ✅ PROFESSIONAL RESTORAN CHEKI generator
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

          // ✅ Chekning oxirida bo‘sh qatorlar chiqib, balandroq bo‘lishi uchun
          printer.feed(10); // 5 ta bo‘sh qator
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
  const BOLD_ON = ESC + "E1";
  const BOLD_OFF = ESC + "E0";
  const SIZE_SMALL = ESC + "!1";
  const SIZE_NORMAL = ESC + "!0";
  const SIZE_LARGE = ESC + "!16";

  // ✅ MINIMAL LINE SPACING
  const LINE_SPACING_TIGHT = ESC + "3" + String.fromCharCode(18);

  const CUT = ESC + "d3" + ESC + "i";
  const INIT = ESC + "@";
  let content = "";

  // ✅ Initialize + tight spacing
  content += INIT;
  content += LINE_SPACING_TIGHT;

  // ✅ PROFESSIONAL Header
  content += ALIGN_CENTER + SIZE_NORMAL + BOLD_ON;
  content += restaurant_name + "\n";
  content += SIZE_SMALL + BOLD_OFF;
  content += phone + "\n";
  content += address + "\n";
  if (website) content += website + "\n";
  content += "\n";

  // ✅ Separator line
  content += ALIGN_CENTER + "================================\n";

  // ✅ Order info (professional format)
  content += ALIGN_LEFT + SIZE_SMALL;
  content += "\n";
  content += `Zakaz: ${order_number}\n`;
  content += `Vaqt: ${date}\n`;
  content += "\n";
  content += `Ofitsiant: ${waiter_name}\n`;
  content += `Stol: ${table_display}\n`;
  content += "\n";

  content += "\n";

  // ✅ Items header
  content += "Nomi        Soni   Summa\n";
  content += "--------------------------------\n";

  // ✅ Items (professional alignment)
  if (items && items.length > 0) {
    items.forEach((item) => {
      const name = (item.name || "Unknown").substring(0, 9).padEnd(9);
      content += "\n";
      const qty = `${item.quantity || 1}x`.padStart(4);
      const price = formatPriceNormal(item.price * item.quantity || 0).padStart(
        10
      );
      content += `${name} ${qty} ${price}\n`;
    });
  }

  content += "\n";

  // ✅ Separator
  content += "--------------------------------\n";

  // ✅ Totals (professional)
  content += ALIGN_LEFT + SIZE_SMALL;
  if (subtotal > 0) {
    content += `Summa: ${formatPriceNormal(subtotal)}\n`;
  }
  content += "\n";
  if (service_amount > 0) {
    content += `Ofitsiant xizmati (${service_percent}%): ${formatPriceNormal(
      service_amount
    )}\n`;
  }
  if (tax_amount > 0) {
    content += `Nalog (${tax_percent}%):             ${formatPriceNormal(
      tax_amount
    )}\n`;
  }

  // ✅ Final separator
  content += "================================\n";

  // ✅ TOTAL (bold and larger)
  content += BOLD_ON + SIZE_NORMAL;
  content += `JAMI:  ${formatPriceNormal(total_amount)}\n`;
  content += BOLD_OFF + SIZE_SMALL;

  // ✅ Professional footer
  content += ALIGN_CENTER;

  // ✅ Cut paper
  content += CUT;
  return content;
}

// ✅ Price formatting (o'zgarishsiz)
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
