const express = require("express");
const router = express.Router();

// Middlewares
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const { onlyAdmin } = require("../middlewares/role.middleware");

// Controllers
const auth = require("../controllers/auth.controller");
const user = require("../controllers/user.controller");
const table = require("../controllers/table.controller");
const category = require("../controllers/category.controller");
const department = require("../controllers/department.controller");
const food = require("../controllers/food.controller");
const order = require("../controllers/order.controller");
const printer = require("../controllers/printer.controller");
const setting = require("../controllers/settings.controller");
const client = require("../controllers/clientController");
const payment = require("../controllers/paymentController");

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
router.get("/orders/completed", authMiddleware, order.getCompletedOrders);
router.get(
  "/orders/pending-payments",
  authMiddleware,
  order.getPendingPayments
);
router.post(
  "/orders/kassir-print/:orderId",
  authMiddleware,
  order.printReceiptForKassir
);
router.post(
  "/orders/process-payment/:orderId",
  authMiddleware,
  order.processPayment
);
router.get("/orders/daily-sales", authMiddleware, order.getDailySalesSummary);
router.post(
  "/orders/:orderId/add-items",
  authMiddleware,
  order.addItemsToOrder
);
router.post(
  "/orders/print-receipt/:orderId",
  authMiddleware,
  order.printReceipt
);
router.post(
  "/orders/:orderId/cancel-item",
  authMiddleware,
  order.cancelOrderItem
);
router.put("/orders/move-table", authMiddleware, order.moveOrderToAnotherTable);

// ===== PAYMENTS =====
router.get(
  "/payments/daily-stats",
  authMiddleware,
  payment.getDailyPaymentStats
);
router.get(
  "/payments/kassir-stats",
  authMiddleware,
  payment.getKassirPaymentStats
);
router.get(
  "/payments/method-stats",
  authMiddleware,
  payment.getPaymentMethodStats
);
router.get("/payments", authMiddleware, payment.getAllPayments);
router.get("/payments/:paymentId", authMiddleware, payment.getPaymentById);

// ===== PRINTERS =====
router.post("/printers", authMiddleware, onlyAdmin, printer.createPrinter);
router.get("/printers", authMiddleware, printer.getPrinters);
router.get("/printers/:id", authMiddleware, printer.getPrinterById);
router.put("/printers/:id", authMiddleware, onlyAdmin, printer.updatePrinter);
router.delete(
  "/printers/:id",
  authMiddleware,
  onlyAdmin,
  printer.deletePrinter
);
router.post(
  "/printers/:id/test",
  authMiddleware,
  onlyAdmin,
  printer.testPrinter
);
router.post(
  "/printers/:id/print-test",
  authMiddleware,
  onlyAdmin,
  printer.printTestReceipt
);

// ===== SETTINGS =====
router.get("/settings", setting.getSettings);
router.post("/settings", authMiddleware, onlyAdmin, setting.createSettings);
router.put("/settings", authMiddleware, onlyAdmin, setting.updateSettings);
router.post(
  "/settings/upload-logo",
  authMiddleware,
  onlyAdmin,
  upload.single("logo"),
  setting.uploadLogo
);
router.delete("/settings/logo", authMiddleware, onlyAdmin, setting.deleteLogo);
router.post(
  "/settings/reset",
  authMiddleware,
  onlyAdmin,
  setting.resetToDefault
);
router.get(
  "/settings/test-receipt",
  authMiddleware,
  setting.generateTestReceipt
);
router.get("/settings/info", setting.getSettingsInfo);
router.get("/settings/public", setting.getSettings);
router.post(
  "/settings/test-kassir-printer",
  authMiddleware,
  onlyAdmin,
  setting.testKassirPrinter
);
router.get(
  "/settings/kassir-printer-status",
  authMiddleware,
  setting.getKassirPrinterStatus
);
router.post("/api/print-image", authMiddleware, setting.printImageReceipt);

// Backward compatibility
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
router.get("/settings/get", setting.getSettings);

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

// ===== KASSIR DASHBOARD =====
router.get("/kassir/dashboard", authMiddleware, order.getPendingPayments);
router.get("/kassir/orders", authMiddleware, order.getCompletedOrders);
router.get("/kassir/sales-summary", authMiddleware, order.getDailySalesSummary);
router.post(
  "/kassir/print/:orderId",
  authMiddleware,
  order.printReceiptForKassir
);
router.post("/kassir/payment/:orderId", authMiddleware, order.processPayment);

// ===== KASSIR PAYMENTS =====
router.get(
  "/kassir/payments/stats",
  authMiddleware,
  payment.getDailyPaymentStats
);
router.get(
  "/kassir/my-payments",
  authMiddleware,
  payment.getKassirPaymentStats
);
router.get("/kassir/payments", authMiddleware, payment.getAllPayments);

// ===== HEALTH CHECK =====
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API ishlayapti",
    timestamp: new Date().toISOString(),
    version: "2.1.0",
    features: {
      kassir_workflow: true,
      html_to_image_print: true,
      payment_processing: true,
      payment_tracking: true,
    },
  });
});

// ===== DEBUG =====
if (process.env.NODE_ENV === "development") {
  router.get("/debug/routes", (req, res) => {
    const routes = [];
    router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods);
        routes.push({
          path: middleware.route.path,
          methods,
          category: middleware.route.path.includes("/kassir")
            ? "kassir"
            : middleware.route.path.includes("/payments")
            ? "payments"
            : middleware.route.path.includes("/orders")
            ? "orders"
            : middleware.route.path.includes("/settings")
            ? "settings"
            : "other",
        });
      }
    });

    const routesByCategory = routes.reduce((acc, route) => {
      const category = route.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(route);
      return acc;
    }, {});

    res.json({
      success: true,
      total_routes: routes.length,
      routes_by_category: routesByCategory,
      kassir_routes: routes.filter((r) => r.category === "kassir"),
      payment_routes: routes.filter((r) => r.category === "payments"),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/debug/kassir-status", authMiddleware, async (req, res) => {
    try {
      const Order = require("../models/Order");
      const Payment = require("../models/Payment");

      const pendingCount = await Order.countDocuments({ status: "completed" });
      const paidCount = await Order.countDocuments({ status: "paid" });
      const paymentCount = await Payment.countDocuments({
        status: "completed",
      });
      const todayPayments = await Payment.countDocuments({
        status: "completed",
        payment_date: new Date().toISOString().split("T")[0],
      });

      res.json({
        success: true,
        kassir_workflow: {
          pending_payments: pendingCount,
          paid_orders: paidCount,
          total_processed: pendingCount + paidCount,
        },
        payment_system: {
          total_payments: paymentCount,
          today_payments: todayPayments,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
}

module.exports = router;
