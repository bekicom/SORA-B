const escpos = require("escpos");
escpos.Network = require("escpos-network");

function initPrinterServer(app) {
  // ✅ Oshxona printeri uchun
  app.post("/print", async (req, res) => {
    try {
      const { items, table_number, waiter_name, date, type } = req.body;

      // Printer IP ni req.body dan olish yoki localhost dan
      const printerIp = req.body.printer_ip || "localhost";

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

        // Mahsulotlarni chiqaramiz
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

  // ✅ Kassir/mijoz cheki uchun
  app.post("/print-check", async (req, res) => {
    try {
      const {
        restaurant_name,
        address,
        phone,
        table_number,
        waiter_name,
        items,
        total_price,
        date,
        order_id,
      } = req.body;

      // Kassir printeri (localhost yoki boshqa IP)
      const device = new escpos.Network("localhost", 9100);
      const printer = new escpos.Printer(device);

      device.open(function (err) {
        if (err) {
          console.error("❌ Kassir printeriga ulanib bo'lmadi:", err.message);
          return res
            .status(400)
            .json({ message: "❌ Kassir printeriga ulanishda xatolik" });
        }

        printer
          .encode("UTF-8")
          .align("CT")
          .size(2, 2)
          .text(restaurant_name || "RESTORAN")
          .size(1, 1)
          .text(address || "")
          .text(`Tel: ${phone || ""}`)
          .text("================================")
          .text("HISOB CHEKI")
          .text("================================")
          .align("LT")
          .text(`Zakaz ID: ${order_id || ""}`)
          .text(`Vaqt: ${date || new Date().toLocaleString("uz-UZ")}`)
          .text(`Stol: ${table_number || ""}`)
          .text(`Ofitsiant: ${waiter_name || ""}`)
          .text("================================");

        // Mahsulotlar ro'yxati
        if (items && items.length > 0) {
          items.forEach((item) => {
            const name = item.name || "Nomaʼlum";
            const qty = item.quantity || 1;
            const price = item.price || 0;
            const totalItemPrice = qty * price;

            printer
              .text(`${name}`)
              .text(
                `  ${qty} x ${price.toLocaleString()} = ${totalItemPrice.toLocaleString()}`
              )
              .text("--------------------------------");
          });
        }

        printer
          .text("================================")
          .align("RT")
          .size(1, 2)
          .text(`JAMI: ${(total_price || 0).toLocaleString()} so'm`)
          .size(1, 1)
          .text("================================")
          .align("CT")
          .text("RAHMAT!")
          .text("Yana tashrif buyuring!")
          .cut()
          .close();

        return res.json({ message: "✅ Kassir cheki chiqarildi!" });
      });
    } catch (err) {
      console.error("❌ Kassir cheki xatosi:", err.message);
      res
        .status(500)
        .json({ message: "❌ Kassir chekini chiqarishda xatolik" });
    }
  });
}

module.exports = initPrinterServer;
