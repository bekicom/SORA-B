const express = require("express");
const router = express.Router();

// ⛔ Middleware
const authMiddleware = require("../middlewares/auth.middleware");

// 🔐 Auth controllers
const { login, register, getMe } = require("../controllers/auth.controller");

// 👤 User controllers
const {
  getAllUsers,
  updateUser,
  deleteUser,
  createUser,
} = require("../controllers/user.controller");

// 🍽 Table controllers
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
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

// ==================== AUTH ====================
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/me", authMiddleware, getMe);

// ==================== USERS ====================
router.post("/users", createUser); // foydalanuvchi yaratish (admin token bilan)
router.get("/users", authMiddleware, getAllUsers);
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);

// ==================== TABLES ====================
router.post("/tables/create", createTable);
router.get("/tables/list", getTables);
router.put("/tables/update/:id", updateTable);
router.delete("/tables/delete/:id", deleteTable);
// ==================== CATEGORIES ====================
router.post("/categories/create", createCategory);        // ➕ Yaratish
router.get("/categories/list", getCategories);            // 📋 Ro‘yxat
router.put("/categories/update/:id", updateCategory);     // 📝 Yangilash
router.delete("/categories/delete/:id", deleteCategory);  // ❌ O‘chirish

// ==================== PRODUCTS ====================

router.post("/products/create", createProduct); // ➕ Mahsulot yaratish
router.get("/products/list", getAllProducts); // 📋 Mahsulotlar ro'yxati
router.put("/products/update/:id", updateProduct); // 📝 Yangilash
router.delete("/products/delete/:id", deleteProduct);
module.exports = router;
