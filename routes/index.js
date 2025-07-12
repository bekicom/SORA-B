const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const { onlyAdmin } = require("../middlewares/role.middleware");

// ==================== CONTROLLERS ====================
const { login, register, getMe } = require("../controllers/auth.controller");

const {
  getAllUsers,
  updateUser,
  deleteUser,
  createUser,
} = require("../controllers/user.controller");

const {
  createTable,
  getTables,
  updateTable,
  deleteTable,
} = require("../controllers/table.controller");

const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const {
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/department.controller");

const {
  createFood,
  getAllFoods,
  updateFood,
  deleteFood,
} = require("../controllers/food.controller");
const {
  createOrder,
  getOrdersByTable,
  updateOrderStatus,
  deleteOrder,
  getBusyTables,
  getMyPendingOrders,
  closeOrder,
} = require("../controllers/order.controller");
const {
  createPrinter,
  getPrinters,
  updatePrinter,
  deletePrinter,
} = require("../controllers/printer.controller");
const {
  getCheckSettings,
  updateCheckSettings,
} = require("../controllers/checkSettings.controller");

// ==================== AUTH ====================
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/me", authMiddleware, getMe);

// ==================== USERS ====================
router.post("/users", authMiddleware, onlyAdmin, createUser);
router.get("/users", getAllUsers);
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);

// ==================== TABLES ====================
router.post("/tables/create", authMiddleware, createTable);
router.get("/tables/list", authMiddleware, getTables);
router.put("/tables/update/:id", authMiddleware, updateTable);
router.delete("/tables/delete/:id", authMiddleware, deleteTable);

// ==================== CATEGORIES ====================
router.post("/categories/create", authMiddleware, createCategory);
router.get("/categories/list", authMiddleware, getCategories);
router.put("/categories/update/:id", authMiddleware, updateCategory);
router.delete("/categories/delete/:id", authMiddleware, deleteCategory);

// ==================== FOODS (TAOMLAR) ====================
router.post("/foods/create", authMiddleware, createFood);
router.get("/foods/list", authMiddleware, getAllFoods);
router.put("/foods/update/:id", authMiddleware, updateFood);
router.delete("/foods/delete/:id", authMiddleware, deleteFood);

// ==================== IMAGE UPLOAD ====================
router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Rasm yuklanmadi" });
  }
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.status(200).json({ imageUrl });
});

// ==================== DEPARTMENTS ====================
router.post("/departments/create", authMiddleware, createDepartment);
router.get("/departments/list", authMiddleware, getAllDepartments);
router.put("/departments/update/:id", authMiddleware, updateDepartment);
router.delete("/departments/delete/:id", authMiddleware, deleteDepartment);

// ==================== ORDERS ====================
router.post("/orders/create", authMiddleware, createOrder);
router.get("/orders/table/:tableId", authMiddleware, getOrdersByTable);
router.put("/orders/status/:orderId", authMiddleware, updateOrderStatus);
router.delete("/orders/delete/:orderId", authMiddleware, deleteOrder);
router.get("/orders/busy-tables", authMiddleware, getBusyTables);
router.get("/orders/my-pending", authMiddleware, getMyPendingOrders);
router.put("/orders/close/:orderId", authMiddleware, closeOrder); // ✅ TUZATILDI


// ==================== PRINTERS ====================
router.post("/printers", authMiddleware, onlyAdmin, createPrinter);
router.get("/printers", authMiddleware, getPrinters);
router.put("/printers/:id", authMiddleware, onlyAdmin, updatePrinter);
router.delete("/printers/:id", authMiddleware, onlyAdmin, deletePrinter);

// ==================== CHECK SETTINGS ====================

router.get("/pechat", getCheckSettings);
router.post("/pechat", updateCheckSettings);
module.exports = router;
