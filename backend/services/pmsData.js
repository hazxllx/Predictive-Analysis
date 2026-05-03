/**
 * Description:
 * Provides patient data access for assessment workflows.
 * Part of Predictive Analysis Subsystem.
 *
 * TODO: connect here to PMS API
 * remove this fallback static patient dataset once backend is fully integrated
 */

// Mock PMS Data — Filipino Patients
const patients = [
  {
    patient_id: "PH001",
    name: "Juan Dela Cruz",
    age: 58,
    gender: "Male",
    address: "Quezon City, Metro Manila",
    contact: "09171234567",
    blood_type: "O+",
    lifestyle: {
      smoking: true,
      alcohol: true,
      physical_activity: "sedentary",
      diet: "poor",
      bmi: 29.5,
    },
    medical_history: {
      hypertension: true,
      diabetes: true,
      heart_disease: false,
      stroke: false,
      kidney_disease: false,
      cancer: false,
      asthma: false,
      copd: false,
    },
    vitals: {
      blood_pressure: "145/92",
      heart_rate: 88,
      temperature: 36.8,
      oxygen_saturation: 96,
      blood_glucose: 210,
      cholesterol: 240,
    },
    family_history: {
      heart_disease: true,
      diabetes: true,
      cancer: false,
      hypertension: true,
    },
    current_medications: ["Metformin", "Amlodipine"],
    last_checkup: "2024-11-15",
  },
  {
    patient_id: "PH002",
    name: "Maria Santos",
    age: 34,
    gender: "Female",
    address: "Makati City, Metro Manila",
    contact: "09281234567",
    blood_type: "A+",
    lifestyle: {
      smoking: false,
      alcohol: false,
      physical_activity: "moderate",
      diet: "balanced",
      bmi: 22.1,
    },
    medical_history: {
      hypertension: false,
      diabetes: false,
      heart_disease: false,
      stroke: false,
      kidney_disease: false,
      cancer: false,
      asthma: true,
      copd: false,
    },
    vitals: {
      blood_pressure: "118/76",
      heart_rate: 72,
      temperature: 36.6,
      oxygen_saturation: 98,
      blood_glucose: 95,
      cholesterol: 175,
    },
    family_history: {
      heart_disease: false,
      diabetes: false,
      cancer: false,
      hypertension: false,
    },
    current_medications: ["Salbutamol inhaler"],
    last_checkup: "2025-01-20",
  },
  {
    patient_id: "PH003",
    name: "Roberto Reyes",
    age: 67,
    gender: "Male",
    address: "Cebu City, Cebu",
    contact: "09391234567",
    blood_type: "B+",
    lifestyle: {
      smoking: true,
      alcohol: true,
      physical_activity: "sedentary",
      diet: "poor",
      bmi: 31.2,
    },
    medical_history: {
      hypertension: true,
      diabetes: true,
      heart_disease: true,
      stroke: false,
      kidney_disease: true,
      cancer: false,
      asthma: false,
      copd: true,
    },
    vitals: {
      blood_pressure: "160/100",
      heart_rate: 95,
      temperature: 37.1,
      oxygen_saturation: 93,
      blood_glucose: 280,
      cholesterol: 265,
    },
    family_history: {
      heart_disease: true,
      diabetes: true,
      cancer: true,
      hypertension: true,
    },
    current_medications: ["Insulin", "Losartan", "Aspirin", "Furosemide"],
    last_checkup: "2024-09-10",
  },
  {
    patient_id: "PH004",
    name: "Ana Liza Bautista",
    age: 45,
    gender: "Female",
    address: "Davao City, Davao del Sur",
    contact: "09451234567",
    blood_type: "AB+",
    lifestyle: {
      smoking: false,
      alcohol: true,
      physical_activity: "light",
      diet: "average",
      bmi: 26.8,
    },
    medical_history: {
      hypertension: true,
      diabetes: false,
      heart_disease: false,
      stroke: false,
      kidney_disease: false,
      cancer: false,
      asthma: false,
      copd: false,
    },
    vitals: {
      blood_pressure: "135/85",
      heart_rate: 80,
      temperature: 36.7,
      oxygen_saturation: 97,
      blood_glucose: 105,
      cholesterol: 210,
    },
    family_history: {
      heart_disease: true,
      diabetes: false,
      cancer: false,
      hypertension: true,
    },
    current_medications: ["Enalapril"],
    last_checkup: "2025-02-05",
  },
  {
    patient_id: "PH005",
    name: "Carlos Mendoza",
    age: 22,
    gender: "Male",
    address: "Baguio City, Benguet",
    contact: "09561234567",
    blood_type: "O-",
    lifestyle: {
      smoking: false,
      alcohol: false,
      physical_activity: "active",
      diet: "balanced",
      bmi: 21.5,
    },
    medical_history: {
      hypertension: false,
      diabetes: false,
      heart_disease: false,
      stroke: false,
      kidney_disease: false,
      cancer: false,
      asthma: false,
      copd: false,
    },
    vitals: {
      blood_pressure: "112/72",
      heart_rate: 65,
      temperature: 36.5,
      oxygen_saturation: 99,
      blood_glucose: 88,
      cholesterol: 155,
    },
    family_history: {
      heart_disease: false,
      diabetes: false,
      cancer: false,
      hypertension: false,
    },
    current_medications: [],
    last_checkup: "2025-03-01",
  },
  {
    patient_id: "PH006",
    name: "Ligaya Fernandez",
    age: 52,
    gender: "Female",
    address: "Iloilo City, Iloilo",
    contact: "09671234567",
    blood_type: "A-",
    lifestyle: {
      smoking: false,
      alcohol: false,
      physical_activity: "moderate",
      diet: "average",
      bmi: 24.3,
    },
    medical_history: {
      hypertension: false,
      diabetes: true,
      heart_disease: false,
      stroke: false,
      kidney_disease: false,
      cancer: false,
      asthma: false,
      copd: false,
    },
    vitals: {
      blood_pressure: "125/80",
      heart_rate: 76,
      temperature: 36.6,
      oxygen_saturation: 97,
      blood_glucose: 165,
      cholesterol: 195,
    },
    family_history: {
      heart_disease: false,
      diabetes: true,
      cancer: false,
      hypertension: false,
    },
    current_medications: ["Glipizide"],
    last_checkup: "2025-01-10",
  },
];

/**
 * Description:
 * Retrieves one patient profile by patient_id.
 *
 * Inputs:
 * - id (patient_id)
 *
 * Output:
 * - patient object or undefined
 */
const getPatientById = (id) => patients.find((p) => p.patient_id === id);

/**
 * Description:
 * Retrieves all available patient profiles.
 *
 * Inputs:
 * - none
 *
 * Output:
 * - array of patient objects
 */
const getAllPatients = () => patients;

module.exports = { getAllPatients, getPatientById };