const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const foundUser = await User.findById(decoded.id).select("-password");

    if (!foundUser) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    req.user = foundUser;
    next();
  } catch {
    res.status(401).json({ message: "Token invalid" });
  }
};

const staffOnly = (req, res, next) => {
  if (req.user && (req.user.role === "staff" || req.user.role === "admin")) return next();
  res.status(403).json({ message: "Staff access only" });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  res.status(403).json({ message: "Admin access only" });
};

module.exports = { protect, staffOnly, adminOnly };
