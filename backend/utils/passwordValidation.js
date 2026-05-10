/**
 * Password Validation Utilities
 *
 * Provides comprehensive password security validation including:
 * - Strong password requirements (length, complexity)
 * - Common password blacklist
 * - Password strength scoring
 * - Detailed validation feedback
 */

// Common weak passwords that should be rejected
const COMMON_PASSWORDS = new Set([
  "123456",
  "password",
  "12345678",
  "qwerty",
  "123456789",
  "12345",
  "1234",
  "111111",
  "1234567",
  "dragon",
  "123123",
  "baseball",
  "abc123",
  "football",
  "monkey",
  "letmein",
  "shadow",
  "master",
  "666666",
  "qwertyuiop",
  "123321",
  "mustang",
  "1234567890",
  "michael",
  "654321",
  "superman",
  "1qaz2wsx",
  "7777777",
  "121212",
  "000000",
  "qazwsx",
  "123qwe",
  "killer",
  "trustno1",
  "jordan",
  "jennifer",
  "zxcvbnm",
  "asdfgh",
  "hunter",
  "buster",
  "soccer",
  "harley",
  "batman",
  "andrew",
  "tigger",
  "sunshine",
  "iloveyou",
  "2000",
  "charlie",
  "robert",
  "thomas",
  "hockey",
  "ranger",
  "daniel",
  "starwars",
  "klaster",
  "112233",
  "george",
  "computer",
  "michelle",
  "jessica",
  "pepper",
  "1111",
  "zxcvbn",
  "555555",
  "11111111",
  "131313",
  "freedom",
  "777777",
  "pass",
  "maggie",
  "159753",
  "aaaaaa",
  "ginger",
  "princess",
  "joshua",
  "cheese",
  "amanda",
  "summer",
  "love",
  "ashley",
  "nicole",
  "chelsea",
  "biteme",
  "matthew",
  "access",
  "yankees",
  "987654321",
  "dallas",
  "austin",
  "thunder",
  "taylor",
  "matrix",
  "mobilemail",
  "mom",
  "monitor",
  "monitoring",
  "montana",
  "moon",
  "moscow",
  "admin123",
  "password123",
  "password1",
  "welcome",
  "login",
  "passw0rd",
]);

/**
 * Validate password against security requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid, errors, and strength
 */
const validatePassword = (password) => {
  const errors = [];
  const passwordStr = String(password || "");

  // Check minimum length (8-12 characters)
  if (passwordStr.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (passwordStr.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(passwordStr)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(passwordStr)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for at least one number
  if (!/[0-9]/.test(passwordStr)) {
    errors.push("Password must contain at least one number");
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(passwordStr)) {
    errors.push("Password must contain at least one special character");
  }

  // Check against common password blacklist
  const lowerPassword = passwordStr.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push("Password is too common. Please choose a stronger password.");
  }

  const isValid = errors.length === 0;
  const strength = calculatePasswordStrength(passwordStr);

  return { isValid, errors, strength };
};

/**
 * Calculate password strength score (0-100)
 * @param {string} password - Password to evaluate
 * @returns {Object} Strength info with score and label
 */
const calculatePasswordStrength = (password) => {
  const passwordStr = String(password || "");
  let score = 0;

  // Length score (up to 25 points)
  if (passwordStr.length >= 8) score += 10;
  if (passwordStr.length >= 10) score += 8;
  if (passwordStr.length >= 12) score += 7;

  // Character variety score (up to 35 points)
  if (/[a-z]/.test(passwordStr)) score += 7; // lowercase
  if (/[A-Z]/.test(passwordStr)) score += 7; // uppercase
  if (/[0-9]/.test(passwordStr)) score += 7; // numbers
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(passwordStr)) score += 14; // special

  // Complexity bonus (up to 25 points)
  const charTypes = new Set();
  if (/[a-z]/.test(passwordStr)) charTypes.add("lower");
  if (/[A-Z]/.test(passwordStr)) charTypes.add("upper");
  if (/[0-9]/.test(passwordStr)) charTypes.add("number");
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(passwordStr)) charTypes.add("special");

  if (charTypes.size === 4) score += 25; // All 4 types
  else if (charTypes.size === 3) score += 15;
  else if (charTypes.size === 2) score += 5;

  // Length bonus for very long passwords (up to 15 points)
  if (passwordStr.length >= 16) score += 15;
  else if (passwordStr.length >= 14) score += 10;

  // Penalize common patterns
  const lowerPassword = passwordStr.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    score = Math.max(0, score - 30);
  }

  // Penalize sequential characters
  if (/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(passwordStr)) {
    score = Math.max(0, score - 10);
  }

  // Penalize repeated characters
  if (/(.)\1{2,}/.test(passwordStr)) {
    score = Math.max(0, score - 10);
  }

  // Normalize score to 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine strength label - require all 4 character types for strong/very strong
  const hasAllTypes = charTypes.size === 4;
  let label = "weak";
  if (score >= 80 && hasAllTypes) label = "very strong";
  else if (score >= 60 && hasAllTypes) label = "strong";
  else if (score >= 40) label = "fair";

  return { score, label };
};

/**
 * Get password requirements as an array of strings
 * @returns {Array} Array of requirement descriptions
 */
const getPasswordRequirements = () => [
  "At least 8 characters (recommended 12+)",
  "At least one uppercase letter (A-Z)",
  "At least one lowercase letter (a-z)",
  "At least one number (0-9)",
  "At least one special character (!@#$%^&* etc.)",
  "Not a common password (e.g., password123, 123456)",
];

module.exports = {
  validatePassword,
  calculatePasswordStrength,
  getPasswordRequirements,
  COMMON_PASSWORDS,
};