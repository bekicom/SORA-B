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
const setting = require("../controllers/settings.controller");

// ===== AUTH =====
router.post("/auth/login", auth.login);
router.post("/auth/register", auth.register);
router.get("/auth/me", authMiddleware, auth.getMe);

// ===== USERS =====
router.post("/users", onlyAdmin, user.createUser);
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

// ===== SETTINGS =====
router.post(
  "/settings/create",
  authMiddleware,
  onlyAdmin,
  setting.createSetting
);
router.put(
  "/settings/update",
  authMiddleware,
  onlyAdmin,
  setting.updateSetting
);
router.get("/settings", authMiddleware, setting.getSetting);

module.exports = router;
