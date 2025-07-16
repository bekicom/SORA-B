const escpos = require("escpos");
escpos.Network = require("escpos-network");

function initPrinterServer(app) {
  // ✅ Oshxona printeri (o'zgarishsiz)
  app.post("/print", async (req, res) => {
    try {
      const { items, table_number, waiter_name, date, type } = req.body;
      const printerIp = req.body.printerIp || "192.168.0.106";
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

  // ✅ YANGI YECHIM: Frontend HTML template'ini print qilish
  app.post("/print-check", async (req, res) => {
    try {
      const {
        restaurant_name,
        address,
        phone,
        email,
        website,
        logo,
        order_number,
        formatted_order_number,
        table_number,
        table_display,
        waiter_name,
        date,
        items,
        subtotal,
        service_percent,
        service_amount,
        tax_percent,
        tax_amount,
        total_amount,
        currency,
        footer_text,
        font_size,
        font_family,
        text_color,
        show_qr,
        kassir_printer_ip,
      } = req.body;

      console.log("🧾 HTML template kassir cheki:", {
        restaurant_name,
        order_number: order_number || formatted_order_number,
        kassir_printer_ip,
        total_amount,
      });

      const kassirIp = kassir_printer_ip || "192.168.0.106";

      // ✅ Frontend HTML template yaratish
      const receiptHTML = generateReceiptHTML({
        restaurant_name: restaurant_name || "SORA",
        phone: phone || "+998 90 123 45 67",
        address: address || "Toshkent sh., Yunusobod tumani",
        website,
        logo,
        date: date || new Date().toLocaleString("uz-UZ"),
        waiter_name: waiter_name || "Natalya",
        table_display: table_display || table_number || "A1",
        guests: 2,
        items: items || [],
        subtotal: subtotal || 0,
        service_percent: service_percent || 10,
        service_amount: service_amount || 0,
        tax_percent: tax_percent || 12,
        tax_amount: tax_amount || 0,
        total_amount: total_amount || 0,
        currency: currency || "UZS",
        footer_text: footer_text || "RAHMAT! Yana tashrif buyuring!",
        font_size: font_size || 14,
        font_family: font_family || "Arial",
        text_color: text_color || "#000000",
        show_qr: show_qr || false,
      });

      // ✅ HTML ni thermal printer format'iga convert qilish
      const device = new escpos.Network(kassirIp, 9100);
      const printer = new escpos.Printer(device);

      device.open(function (err) {
        if (err) {
          console.error(`❌ Kassir printeriga ulanib bo'lmadi:`, err.message);
          return res.status(400).json({
            message: `❌ Kassir printeriga ulanishda xatolik`,
            error: err.message,
            printer_ip: kassirIp,
          });
        }

        // ✅ HTML content'ini thermal format'iga convert
        printHTMLContent(printer, {
          restaurant_name: restaurant_name || "SORA",
          phone: phone || "+998 90 123 45 67",
          address: address || "Toshkent sh., Yunusobod tumani",
          date: date || new Date().toLocaleString("uz-UZ"),
          waiter_name: waiter_name || "Natalya",
          table_display: table_display || table_number || "A1",
          items: items || [],
          subtotal: subtotal || 0,
          service_percent: service_percent || 10,
          service_amount: service_amount || 0,
          tax_percent: tax_percent || 12,
          tax_amount: tax_amount || 0,
          total_amount: total_amount || 0,
          currency: currency || "UZS",
          footer_text: footer_text || "RAHMAT!",
          show_qr: show_qr || false,
        });

        return res.json({
          message: "✅ HTML template kassir cheki chiqarildi!",
          printer_ip: kassirIp,
          order_number: order_number || formatted_order_number,
          html: receiptHTML.substring(0, 200) + "...", // Debug uchun
        });
      });
    } catch (err) {
      console.error("❌ HTML template cheki xatosi:", err.message);
      res.status(500).json({
        message: "❌ HTML template chekini chiqarishda xatolik",
        error: err.message,
      });
    }
  });
}

// ✅ Frontend kabi HTML template yaratish
function generateReceiptHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: ${data.font_family}; 
      font-size: ${data.font_size}px; 
      color: ${data.text_color}; 
      width: 350px; 
      margin: 0; 
      padding: 16px;
      line-height: 1.4;
    }
    .header { text-align: center; margin-bottom: 16px; }
    .restaurant-name { font-size: ${data.font_size + 4}px; font-weight: bold; }
    .contact-info { font-size: ${data.font_size - 1}px; }
    .order-info { margin-bottom: 12px; font-size: ${data.font_size - 1}px; }
    .items-table { width: 100%; margin-bottom: 12px; }
    .items-header { font-weight: bold; font-size: ${data.font_size - 1}px; }
    .item-row { font-size: ${data.font_size - 1}px; margin-top: 4px; }
    .totals { font-size: ${data.font_size - 1}px; }
    .total-final { font-weight: bold; font-size: ${data.font_size}px; }
    .qr-section { text-align: center; margin-top: 16px; }
    .footer { text-align: center; margin-top: 16px; font-size: ${
      data.font_size - 2
    }px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">${data.restaurant_name}</div>
    <div class="contact-info">${data.phone}</div>
    <div class="contact-info">${data.address}</div>
    ${data.website ? `<div class="contact-info">${data.website}</div>` : ""}
  </div>
  
  <div class="order-info">
    <div>Дата: ${data.date}</div>
    <div>Официант: ${data.waiter_name}</div>
    <div>Стол: ${data.table_display}</div>
    <div>Гостей: ${data.guests}</div>
  </div>
  
  <div class="items-table">
    <div class="items-header">
      <span style="display: inline-block; width: 50%;">Наименование</span>
      <span style="display: inline-block; width: 25%; text-align: center;">Кол</span>
      <span style="display: inline-block; width: 25%; text-align: right;">Сумма</span>
    </div>
    ${data.items
      .map(
        (item) => `
      <div class="item-row">
        <span style="display: inline-block; width: 50%;">${item.name}</span>
        <span style="display: inline-block; width: 25%; text-align: center;">${
          item.quantity
        }</span>
        <span style="display: inline-block; width: 25%; text-align: right;">${item.price.toLocaleString()}</span>
      </div>
    `
      )
      .join("")}
  </div>
  
  <div class="totals">
    <div>Сумма: ${data.subtotal.toLocaleString()} ${data.currency}</div>
    <div>Обслуживание (${
      data.service_percent
    }%): ${data.service_amount.toLocaleString()} ${data.currency}</div>
    <div>Налог (${data.tax_percent}%): ${data.tax_amount.toLocaleString()} ${
    data.currency
  }</div>
    <div class="total-final">ИТОГО: ${data.total_amount.toLocaleString()} ${
    data.currency
  }</div>
  </div>
  
  ${data.show_qr ? '<div class="qr-section">[QR КОД]</div>' : ""}
  
  ${data.footer_text ? `<div class="footer">${data.footer_text}</div>` : ""}
</body>
</html>`;
}

// ✅ HTML content'ini thermal printer format'iga convert
function printHTMLContent(printer, data) {
  printer.encode("UTF-8");

  // Header
  printer
    .align("CT")
    .size(2, 1)
    .text(data.restaurant_name)
    .size(1, 1)
    .text(data.phone)
    .text(data.address)
    .text("");

  // Order info
  printer
    .align("LT")
    .text(`Data: ${data.date}`)
    .text(`Ofitsiant: ${data.waiter_name}`)
    .text(`Stol: ${data.table_display}`)
    .text(`Gostey: 2`)
    .text("");

  // Items header
  printer.text("Naimenovanie      Kol  Summa");

  // Items
  data.items.forEach((item) => {
    const name = item.name.substring(0, 17).padEnd(17);
    const qty = item.quantity.toString().padStart(2);
    const price = item.price.toLocaleString().padStart(6);
    printer.text(`${name} ${qty}  ${price}`);
  });

  printer.text("");

  // Totals
  printer
    .text(
      `Summa:               ${data.subtotal.toLocaleString()} ${data.currency}`
    )
    .text(
      `Obsluzhivanie (${
        data.service_percent
      }%):  ${data.service_amount.toLocaleString()} ${data.currency}`
    )
    .text(
      `Nalog (${
        data.tax_percent
      }%):        ${data.tax_amount.toLocaleString()} ${data.currency}`
    )
    .text("")
    .size(1, 2)
    .text(
      `ITOGO:         ${data.total_amount.toLocaleString()} ${data.currency}`
    )
    .size(1, 1);

  // QR code
  if (data.show_qr) {
    printer.text("").align("CT").text("[QR KOD]");
  }

  // Footer
  if (data.footer_text) {
    printer.text("").align("CT").text(data.footer_text);
  }

  printer.cut().close();
}

module.exports = initPrinterServer;
