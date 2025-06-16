const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const { onlyAdmin } = require("../middlewares/role.middleware");
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

// 📂 Category controllers
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

// 🍔 Product controllers
const {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");
const {
  createOrder,
  getAllOrders,
} = require("../controllers/order.controller");

// ==================== AUTH ====================
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/me", authMiddleware, getMe);

// ==================== USERS ====================
router.post("/users", authMiddleware, createUser);
router.get("/users",  getAllUsers); // Admin uchun barcha foydalanuvchilarni olish
router.post("/users", authMiddleware, createUser); 
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);
router.post("/users", authMiddleware, onlyAdmin, createUser);
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

// ==================== PRODUCTS ====================
router.post("/products/create", authMiddleware, createProduct);
router.get("/products/list", authMiddleware, getAllProducts);
router.put("/products/update/:id", authMiddleware, updateProduct);
router.delete("/products/delete/:id", authMiddleware, deleteProduct);

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

// ==================== ORDERS ====================
router.post("/orders/create", authMiddleware, createOrder); // ofitsiant
router.get("/orders/list", authMiddleware, getAllOrders); // admin

module.exports = router;
