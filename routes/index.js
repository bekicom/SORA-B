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

// ==================== AUTH ====================
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/me", authMiddleware, getMe);

// ==================== USERS ====================
router.post("/users", authMiddleware, onlyAdmin, createUser);
router.get("/users", authMiddleware, getAllUsers);
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

module.exports = router;
