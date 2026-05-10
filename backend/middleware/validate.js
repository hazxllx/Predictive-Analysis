/**
 * Input Validation Middleware
 *
 * Provides declarative, reusable request validation for body, query, and params.
 * Supports chained rules with custom error messages.
 *
 * Usage:
 *   router.post("/register", validateBody(registerSchema), register);
 *   router.get("/", validateQuery(listSchema), listUsers);
 *
 * Schemas are plain objects where each key maps to an array of validator functions.
 * Each validator returns { valid: boolean, message?: string }.
 */

const { body, query, param, validationResult } = require("express-validator");
const { validatePassword } = require("../utils/passwordValidation");

/**
 * Generic validation result handler
 * Collects all express-validator errors and returns a standardized 400 response
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const firstError = errors.array({ onlyFirstError: true })[0];
  return res.status(400).json({
    message: firstError.msg,
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

// ── Reusable field validators ──

const isRequired = (field) => body(field).trim().notEmpty().withMessage(`${field} is required`);
const isEmail = (field = "email") =>
  body(field).trim().isEmail().withMessage("Enter a valid email address");
const isUsername = (field = "username") =>
  body(field)
    .trim()
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Username must use letters, numbers, and underscores only (no spaces)");
const isPassword = (field = "password") =>
  body(field).custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    return true;
  });
const isOptionalString = (field) => body(field).optional().trim().notEmpty().withMessage(`${field} cannot be empty`);
const isRole = (field = "role") =>
  body(field)
    .optional()
    .isIn(["patient", "admin"])
    .withMessage("Role must be patient or admin");
const isObjectId = (field, location = "param") => {
  const chain = location === "param" ? param(field) : body(field);
  return chain
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);
};

// ── Auth validation chains ──

const registerValidators = [
  isRequired("name"),
  isUsername("username"),
  isEmail("email"),
  isPassword("password"),
  isRole("role"),
  handleValidationErrors,
];

const loginValidators = [
  body("identifier")
    .custom((value, { req }) => {
      const id = String(value || "").trim();
      const email = String(req.body?.email || "").trim();
      const username = String(req.body?.username || "").trim();
      if (!id && !email && !username) {
        throw new Error("Email or username is required");
      }
      return true;
    }),
  body("password").trim().notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const changePasswordValidators = [
  isRequired("currentPassword"),
  isPassword("newPassword"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("New password and confirmation do not match"),
  handleValidationErrors,
];

// ── User validation chains ──

const createUserValidators = [
  isRequired("name"),
  isUsername("username"),
  isEmail("email"),
  isPassword("password"),
  body("role").notEmpty().withMessage("Role is required").isIn(["patient", "admin"]).withMessage("Invalid role"),
  handleValidationErrors,
];

const updateUserValidators = [
  isObjectId("id", "param"),
  body("email").optional().trim().isEmail().withMessage("Enter a valid email address"),
  body("username")
    .optional()
    .trim()
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Username must use letters, numbers, and underscores only (no spaces)"),
  body("role").optional().isIn(["patient", "admin"]).withMessage("Invalid role"),
  body("password")
    .optional()
    .custom((value) => {
      if (value) {
        const validation = validatePassword(value);
        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }
      }
      return true;
    }),
  handleValidationErrors,
];

const deleteUserValidators = [isObjectId("id", "param"), handleValidationErrors];

// ── Assessment validation chains ──

const assessmentValidators = [
  body("patient_id").trim().notEmpty().withMessage("patient_id is required"),
  handleValidationErrors,
];

const getAssessmentValidators = [
  query("id").optional().trim().notEmpty().withMessage("id query parameter cannot be empty"),
  handleValidationErrors,
];

// ── Patient validation chains ──

const getPatientByIdValidators = [
  param("id").trim().notEmpty().withMessage("Patient ID is required"),
  handleValidationErrors,
];

// ── Sanitization helpers ──

/**
 * Trim all string values in req.body recursively (top-level only)
 */
const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

/**
 * Normalize common fields (lowercase email, username)
 */
const normalizeAuthFields = (req, _res, next) => {
  if (req.body.email) req.body.email = String(req.body.email).trim().toLowerCase();
  if (req.body.username) req.body.username = String(req.body.username).trim().toLowerCase();
  if (req.body.identifier) {
    const id = String(req.body.identifier).trim();
    req.body.identifier = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) ? id.toLowerCase() : id;
  }
  next();
};

module.exports = {
  handleValidationErrors,
  isRequired,
  isEmail,
  isUsername,
  isPassword,
  isRole,
  isObjectId,
  sanitizeBody,
  normalizeAuthFields,
  registerValidators,
  loginValidators,
  changePasswordValidators,
  createUserValidators,
  updateUserValidators,
  deleteUserValidators,
  assessmentValidators,
  getAssessmentValidators,
  getPatientByIdValidators,
};
