const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

class HTMLReceiptService {
  constructor() {
    this.browser = null;
  }

  // Browser ochish
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this.browser;
  }

  // HTML chek yaratish
  generateReceiptHTML(orderData) {
    const { table_number, items, waiter_name, type } = orderData;
    const itemsArray = Array.isArray(items) ? items : Object.values(items);

    const now = new Date();
    const time = now.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = now.toLocaleDateString("uz-UZ");

    const totalItems = itemsArray.reduce(
      (sum, item) => sum + (item.quantity || item.count || 1),
      0
    );

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kitchen Order</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.4;
                color: #000;
                background: white;
                padding: 10px;
                width: 80mm;
                margin: 0 auto;
            }
            
            .receipt {
                border: 2px solid #000;
                padding: 15px;
                background: white;
            }
            
            .header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            
            .title {
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 1px;
                margin-bottom: 5px;
            }
            
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
            }
            
            .info-label {
                font-weight: bold;
            }
            
            .separator {
                border-bottom: 1px dashed #000;
                margin: 10px 0;
            }
            
            .items {
                margin: 15px 0;
            }
            
            .item {
                margin-bottom: 10px;
                padding: 5px 0;
                border-bottom: 1px dotted #ccc;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
                font-size: 16px;
            }
            
            .item-qty {
                background: #000;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 14px;
                min-width: 30px;
                text-align: center;
            }
            
            .item-name {
                flex: 1;
                margin-left: 10px;
                text-transform: uppercase;
            }
            
            .item-comment {
                margin-top: 5px;
                padding-left: 40px;
                font-style: italic;
                color: #666;
                font-size: 12px;
            }
            
            .total {
                margin-top: 20px;
                padding-top: 10px;
                border-top: 2px solid #000;
                text-align: center;
            }
            
            .total-text {
                font-size: 16px;
                font-weight: bold;
                background: #000;
                color: white;
                padding: 8px;
                border-radius: 5px;
            }
            
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 12px;
                color: #666;
            }
            
            @media print {
                body {
                    width: 80mm;
                    margin: 0;
                    padding: 0;
                }
                
                .receipt {
                    border: none;
                    padding: 5px;
                }
            }
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <div class="title">🍽️ YANGI BUYURTMA 🍽️</div>
            </div>
            
            <div class="info-row">
                <span class="info-label">Vaqt:</span>
                <span>${time}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Sana:</span>
                <span>${date}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Stol:</span>
                <span><strong>${table_number}</strong></span>
            </div>
            
            <div class="info-row">
                <span class="info-label">Ofitsiant:</span>
                <span>${waiter_name}</span>
            </div>
            
            <div class="separator"></div>
            
            <div class="items">
                ${itemsArray
                  .map((item) => {
                    const quantity = item.quantity || item.count || 1;
                    const name = item.name || item.title || "Noma'lum taom";
                    const comment = item.comment || item.note;

                    return `
                        <div class="item">
                            <div class="item-header">
                                <div class="item-qty">${quantity}x</div>
                                <div class="item-name">${name}</div>
                            </div>
                            ${
                              comment
                                ? `<div class="item-comment">💬 ${comment}</div>`
                                : ""
                            }
                        </div>
                    `;
                  })
                  .join("")}
            </div>
            
            <div class="total">
                <div class="total-text">
                    JAMI: ${totalItems} TA TAOM
                </div>
            </div>
            
            <div class="footer">
                <p>⏰ ${new Date().toLocaleString("uz-UZ")}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return html;
  }

  // PDF yaratish va printerga yuborish
  async printReceipt(orderData) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Chek HTML yaratish
      const html = this.generateReceiptHTML(orderData);

      // PDF sozlamalari
      await page.setContent(html, { waitUntil: "networkidle0" });

      // PDF yaratish
      const pdfPath = path.join(__dirname, "temp", `receipt-${Date.now()}.pdf`);

      // Temp papka yaratish
      const tempDir = path.join(__dirname, "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      await page.pdf({
        path: pdfPath,
        format: "A4",
        width: "80mm",
        height: "200mm",
        printBackground: true,
        margin: {
          top: "5mm",
          right: "2mm",
          bottom: "5mm",
          left: "2mm",
        },
      });

      // Faylni printerga yuborish (Windows/Linux uchun)
      await this.sendToPrinter(pdfPath);

      // Temp faylni o'chirish
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      }, 5000);

      return {
        message: "Chek muvaffaqiyatli chop etildi",
        details: {
          table: orderData.table_number,
          items_count: Array.isArray(orderData.items)
            ? orderData.items.length
            : Object.keys(orderData.items).length,
          pdf_path: pdfPath,
        },
      };
    } catch (error) {
      throw new Error(`PDF chek yaratishda xatolik: ${error.message}`);
    }
  }

  // Printerga yuborish
  async sendToPrinter(pdfPath) {
    const { exec } = require("child_process");

    return new Promise((resolve, reject) => {
      // Windows uchun
      if (process.platform === "win32") {
        exec(
          `powershell -Command "Start-Process -FilePath '${pdfPath}' -Verb Print"`,
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      }
      // Linux uchun
      else {
        exec(`lpr "${pdfPath}"`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  // Browser yopish
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = HTMLReceiptService;
