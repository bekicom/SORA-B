const multer = require("multer");
const path = require("path");

// Fayllarni saqlash joyi
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // 📁 uploads papkasi ichiga saqlanadi
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

// Filter: ruxsat berilgan rasm turlari
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Faqat JPG, JPEG va PNG fayllar yuklanadi"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
