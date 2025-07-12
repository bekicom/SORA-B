const net = require("net");

class PrintService {
  constructor(printerIP = "192.168.0.100", printerPort = 9100) {
    this.printerIP = printerIP;
    this.printerPort = printerPort;
  }

  // Chek matnini tayyorlash
  formatReceipt(orderData) {
    const { table_number, items, waiter_name, type } = orderData;

    // items ni to'g'ri formatga o'tkazamiz
    const itemsArray = Array.isArray(items) ? items : Object.values(items);

    // Hozirgi vaqt
    const now = new Date();
    const time = now.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = now.toLocaleDateString("uz-UZ");

    // Oshpazlar uchun sodda buyurtma cheki
    let printText = "";

    printText += "\n";
    printText += "================================\n";
    printText += "        YANGI BUYURTMA        \n";
    printText += "================================\n";
    printText += "\n";

    // Asosiy ma'lumot
    printText += `Vaqt: ${time}        Sana: ${date}\n`;
    printText += `STOL: ${table_number}      Ofitsiant: ${waiter_name}\n`;
    printText += "\n";
    printText += "--------------------------------\n";
    printText += "\n";

    // Buyurtma - katta va aniq
    itemsArray.forEach((item) => {
      // Xatoliklarni tekshirish
      const quantity = item.quantity || item.count || 1;
      const name = item.name || item.title || "Noma'lum taom";

      // Miqdorni katta qilib ko'rsatish
      const qty = quantity.toString().padStart(2, " ");
      printText += `${qty}x  ${name.toUpperCase()}\n`;

      // Agar izoh bo'lsa
      if (item.comment || item.note) {
        printText += `     » ${item.comment || item.note}\n`;
      }
      printText += "\n";
    });

    printText += "--------------------------------\n";
    printText += `JAMI: ${itemsArray.reduce(
      (sum, item) => sum + (item.quantity || item.count || 1),
      0
    )} TA TAOM\n`;
    printText += "--------------------------------\n";
    printText += "\n\n\n";

    return {
      printText,
      orderSummary: {
        table: table_number,
        items_count: itemsArray.length,
        total_quantity: itemsArray.reduce(
          (sum, item) => sum + (item.quantity || item.count || 1),
          0
        ),
        time: time,
        date: date,
      },
    };
  }

  // Printerga yuborish
  async printOrder(orderData) {
    return new Promise((resolve, reject) => {
      try {
        const { printText, orderSummary } = this.formatReceipt(orderData);

        const client = new net.Socket();

        client.connect(this.printerPort, this.printerIP, () => {
          // ESC/POS format bilan yuborish
          const ESC = "\x1b";
          const init = ESC + "@"; // Printerni reset qilish
          const cut = ESC + "i"; // Qog'ozni kesish

          // Encoding: CP866 (Cyrillic) yoki Latin-1
          const fullText = init + printText + cut;

          client.write(fullText, "binary");
          client.end();

          resolve({
            message: "Chek muvaffaqiyatli yuborildi",
            details: orderSummary,
          });
        });

        client.on("error", (err) => {
          console.error("Printer xatoligi:", err);
          reject(
            new Error(`Printer bilan bog'lanishda xatolik: ${err.message}`)
          );
        });

        client.on("timeout", () => {
          client.destroy();
          reject(new Error("Printer javob bermadi (timeout)"));
        });

        // 5 soniya timeout
        client.setTimeout(5000);
      } catch (err) {
        reject(new Error(`Chek tayyorlashda xatolik: ${err.message}`));
      }
    });
  }
}

module.exports = PrintService;
