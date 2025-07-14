const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const { onlyAdmin } = require("../middlewares/role.middleware");

// ===== CONTROLLERS =====
const auth = require("../controllers/auth.controller");
const user = require("../controllers/user.controller");
const table = require("../controllers/table.controller");
const category = require("../controllers/category.controller");
const department = require("../controllers/department.controller");
const food = require("../controllers/food.controller");
const order = require("../controllers/order.controller");
const printer = require("../controllers/printer.controller");
const setting = require("../controllers/settings.controller"); // ✅ Tuzatildi
const client = require("../controllers/clientController");

// ===== AUTH =====
router.post("/auth/login", auth.login);
router.post("/auth/register", auth.register);
router.get("/auth/me", authMiddleware, auth.getMe);

// ===== USERS =====
router.post("/users", authMiddleware, onlyAdmin, user.createUser);
router.get("/users", user.getAllUsers);
router.put("/users/:id", authMiddleware, user.updateUser);
router.delete("/users/:id", authMiddleware, user.deleteUser);

// ===== TABLES =====
router.post("/tables/create", authMiddleware, table.createTable);
router.get("/tables/list", authMiddleware, table.getTables);
router.put("/tables/update/:id", authMiddleware, table.updateTable);
router.delete("/tables/delete/:id", authMiddleware, table.deleteTable);

// ===== CATEGORIES =====
router.post("/categories/create", authMiddleware, category.createCategory);
router.get("/categories/list", authMiddleware, category.getCategories);
router.put("/categories/update/:id", authMiddleware, category.updateCategory);
router.delete(
  "/categories/delete/:id",
  authMiddleware,
  category.deleteCategory
);

// ===== FOODS =====
router.post("/foods/create", authMiddleware, food.createFood);
router.get("/foods/list", authMiddleware, food.getAllFoods);
router.put("/foods/update/:id", authMiddleware, food.updateFood);
router.delete("/foods/delete/:id", authMiddleware, food.deleteFood);

// ===== IMAGE UPLOAD =====
router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Rasm yuklanmadi" });

  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.status(200).json({ imageUrl });
});

// ===== DEPARTMENTS =====
router.post("/departments/create", authMiddleware, department.createDepartment);
router.get("/departments/list", authMiddleware, department.getAllDepartments);
router.put(
  "/departments/update/:id",
  authMiddleware,
  department.updateDepartment
);
router.delete(
  "/departments/delete/:id",
  authMiddleware,
  department.deleteDepartment
);

// ===== ORDERS =====
router.post("/orders/create", authMiddleware, order.createOrder);
router.get("/orders/table/:tableId", authMiddleware, order.getOrdersByTable);
router.put("/orders/status/:orderId", authMiddleware, order.updateOrderStatus);
router.delete("/orders/delete/:orderId", authMiddleware, order.deleteOrder);
router.get("/orders/busy-tables", authMiddleware, order.getBusyTables);
router.get("/orders/my-pending", authMiddleware, order.getMyPendingOrders);
router.put("/orders/close/:orderId", authMiddleware, order.closeOrder);

// ===== PRINTERS =====
router.post("/printers", authMiddleware, onlyAdmin, printer.createPrinter);
router.get("/printers", authMiddleware, printer.getPrinters);
router.put("/printers/:id", authMiddleware, onlyAdmin, printer.updatePrinter);
router.delete(
  "/printers/:id",
  authMiddleware,
  onlyAdmin,
  printer.deletePrinter
);
router.get("/printers/:id", authMiddleware, printer.getPrinterById); // ✅ Qo'shildi
router.post(
  "/printers/:id/test",
  authMiddleware,
  onlyAdmin,
  printer.testPrinter
); // ✅ Qo'shildi
router.post(
  "/printers/:id/print-test",
  authMiddleware,
  onlyAdmin,
  printer.printTestReceipt
); // ✅ Qo'shildi

// ===== SETTINGS (TO'LIQ YANGILANDI) =====
// 📖 Sozlamalarni olish
router.get("/settings", setting.getSettings); // ✅ authMiddleware olib tashlandi (frontend uchun)

// ➕ Sozlamalarni yaratish
router.post("/settings", authMiddleware, onlyAdmin, setting.createSettings);

// ✏️ Sozlamalarni yangilash
router.put("/settings", authMiddleware, onlyAdmin, setting.updateSettings);

// 🖼️ Logo yuklash
router.post(
  "/settings/upload-logo",
  authMiddleware,
  onlyAdmin,
  setting.uploadLogo
);

// 🗑️ Logo o'chirish
router.delete("/settings/logo", authMiddleware, onlyAdmin, setting.deleteLogo);

// 🔄 Default holatga qaytarish
router.post(
  "/settings/reset",
  authMiddleware,
  onlyAdmin,
  setting.resetToDefault
);

// 🧪 Test chek ma'lumotlari
router.get(
  "/settings/test-receipt",
  authMiddleware,
  setting.generateTestReceipt
);

// 📊 Sozlamalar info
router.get("/settings/info", setting.getSettingsInfo);

// 📱 Public sozlamalar (auth siz)
router.get("/settings/public", (req, res) => {
  // Public ma'lumotlarni qaytarish
  setting.getSettings(req, res);
});

// ===== ESKI SETTINGS ROUTES (DEPRECATED - BACKWARD COMPATIBILITY) =====
// Eski frontend bilan mos kelishi uchun
router.post(
  "/settings/create",
  authMiddleware,
  onlyAdmin,
  setting.createSettings
);
router.put(
  "/settings/update",
  authMiddleware,
  onlyAdmin,
  setting.updateSettings
);
router.get("/settings/get", setting.getSettings); // Eski route

// ===== CLIENTS =====
router.post("/clients/create", authMiddleware, client.createClient);
router.get("/clients/list", authMiddleware, client.getAllClients);
router.get("/clients/:id", authMiddleware, client.getClientById);
router.put("/clients/update/:id", authMiddleware, client.updateClient);
router.delete("/clients/delete/:id", authMiddleware, client.deleteClient);
router.get(
  "/clients/by-card/:card_number",
  authMiddleware,
  client.getClientByCardNumber
);

// ===== HEALTH CHECK =====
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API ishlayapti",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});



// ===== DEBUG INFO (DEVELOPMENT ONLY) =====
if (process.env.NODE_ENV === "development") {
  router.get("/debug/routes", (req, res) => {
    const routes = [];

    router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods);
        routes.push({
          path: middleware.route.path,
          methods: methods,
        });
      }
    });

    res.json({
      success: true,
      total_routes: routes.length,
      routes: routes,
    });
  });
}

module.exports = router;
