const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const printer = require("pdf-to-printer");

const printOrder = async ({ table_number, items, total_price }) => {
  const filePath = path.join(__dirname, "chek.pdf");
  const doc = new PDFDocument();

  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(16).text("🧾 CHEK", { align: "center" });
  doc.text(`Stol raqami: ${table_number}`);
  doc.moveDown();

  items.forEach((item) => {
    doc.text(`${item.name} x${item.quantity} - ${item.price} so'm`);
  });

  doc.moveDown();
  doc.text(`Jami: ${total_price} so'm`, { align: "right" });
  doc.text("Rahmat!", { align: "center" });

  doc.end();

  // 1 sekund kutamiz va printerga yuboramiz
  setTimeout(() => {
    printer
      .print(filePath)
      .then(() => console.log("✅ Chek printerga yuborildi"))
      .catch((err) => console.error("❌ Printer xatolik:", err));
  }, 1000);
};

module.exports = printOrder;
