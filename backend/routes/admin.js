/**
 * Admin Routes
 *
 * Protected admin-only endpoints for:
 * - User CRUD operations (list, create, update, delete)
 * - Dashboard statistics (counts of users, patients, assessments)
 *
 * All routes require admin authentication (protect + adminOnly).
 * Business logic is handled by adminController.
 */

const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getStats,
} = require("../controllers/adminController");
const {
  sanitizeBody,
  normalizeAuthFields,
  createUserValidators,
  updateUserValidators,
  deleteUserValidators,
} = require("../middleware/validate");

// Apply admin-only guard to all routes in this file
router.use(protect, adminOnly);

router.get("/users", listUsers);
router.post("/users", sanitizeBody, normalizeAuthFields, createUserValidators, createUser);
router.put("/users/:id", sanitizeBody, normalizeAuthFields, updateUserValidators, updateUser);
router.delete("/users/:id", deleteUserValidators, deleteUser);
router.get("/stats", getStats);

module.exports = router;
