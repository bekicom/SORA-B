exports.onlyAdmin = (req, res, next) => {
  // Avval req.user mavjudligini tekshirish
  if (!req.user) {
    return res.status(401).json({ message: "Autentifikatsiya talab qilinadi" });
  }

  // Keyin role tekshirish
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Faqat admin ruxsat etilgan" });
  }

  next();
};
