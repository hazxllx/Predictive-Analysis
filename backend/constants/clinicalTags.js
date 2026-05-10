/**
 * Clinical Tags — Centralized Medical Taxonomy
 *
 * Single source of truth for all medically valid conditions,
 * aliases, scoring weights, category mapping, specialists,
 * lab tests, and recommendation templates.
 *
 * Security:
 * - NEVER accepts free-text / arbitrary input as a medical tag
 * - All aliases map to canonical labels only
 * - Junk/rejected terms are filtered by normalizeClinicalTag()
 */

const CLINICAL_CATEGORIES = {
  CARDIOVASCULAR: "Cardiovascular",
  METABOLIC: "Metabolic",
  RESPIRATORY: "Respiratory",
  RENAL: "Renal",
  NEUROLOGICAL: "Neurological",
  MENTAL: "Mental Health",
  ONCOLOGY: "Oncology",
  REPRODUCTIVE: "Reproductive",
  INFECTIOUS: "Infectious",
  MUSCULOSKELETAL: "Musculoskeletal",
  LIFESTYLE: "Lifestyle",
  FAMILY_HISTORY: "Family History",
  PREVENTIVE: "Preventive",
};

/**
 * Rejected terms — these are NEVER valid medical tags.
 * Any input matching these (case-insensitive, after trim)
 * is silently rejected.
 */
const REJECTED_TERMS = new Set([
  "wala lang",
  "need help",
  "okay lang",
  "none",
  "unknown",
  "n/a",
  "test",
  "lorem ipsum",
  "placeholder",
  "random",
  "comment",
  "note",
  "todo",
  "check",
  "review",
  "pending",
  "na",
  "wala",
  "hindi alam",
  "di alam",
  "ewan",
  "basta",
  "sige",
  "ok",
  "oks",
  "okay",
  "fine",
  "good",
  "no issues",
  "no problem",
  "none noted",
  "not applicable",
  "not available",
  "not sure",
  "unsure",
  "maybe",
  "possibly",
  "probably",
  "",
]);

/**
 * Clinical tag master registry.
 * Each canonical label maps to:
 *   aliases[]        — Filipino/common synonyms
 *   category         — CLINICAL_CATEGORIES value
 *   weight           — Risk score contribution (0–100 scale)
 *   specialists[]    — Recommended specialists
 *   labTests[]       — Suggested laboratory tests
 *   recommendations[] — Template recommendations
 */
const CLINICAL_TAG_REGISTRY = {
  // ── CARDIOVASCULAR ──
  "Hypertension": {
    aliases: ["high blood", "mataas blood", "highblood", "high bp", "bp mataas", "elevated bp"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 25,
    specialists: ["Cardiologist", "Internal Medicine"],
    labTests: ["Blood Pressure Monitoring", "ECG", "Lipid Profile", "Kidney Function Test"],
    recommendations: [
      "Monitor blood pressure daily at home",
      "Reduce sodium intake to <2,300mg/day",
      "Take prescribed antihypertensives consistently",
      "Schedule cardiology follow-up every 3–6 months",
    ],
  },
  "Hypotension": {
    aliases: ["low blood", "lowblood", "low bp", "bp mababa"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 8,
    specialists: ["Cardiologist", "Internal Medicine"],
    labTests: ["Blood Pressure Monitoring", "ECG", "Complete Blood Count (CBC)"],
    recommendations: [
      "Monitor blood pressure regularly",
      "Stay hydrated; increase fluid intake",
      "Rise slowly from sitting/lying positions",
    ],
  },
  "Stroke": {
    aliases: ["na-stroke", "cva", "brain attack", "cerebrovascular accident"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 35,
    specialists: ["Neurologist", "Cardiologist", "Rehabilitation Medicine"],
    labTests: ["CT Scan / MRI Brain", "Carotid Ultrasound", "ECG", "Lipid Profile", "Coagulation Profile"],
    recommendations: [
      "Strict blood pressure control",
      "Take antiplatelet/anticoagulant medications as prescribed",
      "Regular neurology follow-up",
      "Engage in stroke rehabilitation therapy",
    ],
  },
  "TIA": {
    aliases: ["transient ischemic attack", "mini stroke", "warning stroke"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 28,
    specialists: ["Neurologist", "Cardiologist"],
    labTests: ["CT Scan / MRI Brain", "Carotid Ultrasound", "ECG", "Lipid Profile"],
    recommendations: [
      "Urgent neurology evaluation",
      "Start antiplatelet therapy if prescribed",
      "Control blood pressure, blood sugar, and cholesterol",
    ],
  },
  "Heart Disease": {
    aliases: ["sakit sa puso", "heart problem", "cardiac disease", "heart condition"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 30,
    specialists: ["Cardiologist"],
    labTests: ["ECG", "Echocardiogram", "Lipid Profile", "Troponin"],
    recommendations: [
      "Regular cardiology follow-up",
      "Take cardiac medications consistently",
      "Avoid strenuous activity without clearance",
    ],
  },
  "Coronary Artery Disease": {
    aliases: ["cad", "coronary heart disease", "blocked arteries", "atherosclerosis"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 32,
    specialists: ["Cardiologist", "Interventional Cardiologist"],
    labTests: ["ECG", "Stress Test", "Coronary Angiography", "Lipid Profile"],
    recommendations: [
      "Strict lipid and blood pressure control",
      "Take statins and antiplatelets as prescribed",
      "Consider cardiac rehabilitation program",
    ],
  },
  "Heart Failure": {
    aliases: ["chf", "congestive heart failure", "weak heart", "heart not pumping well"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 34,
    specialists: ["Cardiologist", "Heart Failure Specialist"],
    labTests: ["ECG", "Echocardiogram", "BNP / NT-proBNP", "Kidney Function Test"],
    recommendations: [
      "Daily weight monitoring; report sudden gain >2kg in 3 days",
      "Limit fluid and salt intake as advised",
      "Take heart failure medications strictly",
    ],
  },
  "Heart Attack": {
    aliases: ["inaatake sa puso", "myocardial infarction", "mi", "acute mi"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 35,
    specialists: ["Cardiologist", "Interventional Cardiologist"],
    labTests: ["ECG", "Troponin", "Coronary Angiography", "Lipid Profile"],
    recommendations: [
      "Emergency cardiology care if symptoms recur",
      "Cardiac rehabilitation after stabilization",
      "Strict adherence to antiplatelet, statin, and BP medications",
    ],
  },
  "Arrhythmia": {
    aliases: ["irregular heartbeat", "palpitations", "abnormal heart rhythm"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 18,
    specialists: ["Cardiologist", "Electrophysiologist"],
    labTests: ["ECG", "Holter Monitor", "Echocardiogram"],
    recommendations: [
      "Monitor pulse regularly",
      "Avoid stimulants (caffeine, energy drinks)",
      "Cardiology follow-up for rhythm management",
    ],
  },
  "Angina": {
    aliases: ["chest pain", "sakit sa dibdib", "chest tightness"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 22,
    specialists: ["Cardiologist"],
    labTests: ["ECG", "Stress Test", "Coronary Angiography"],
    recommendations: [
      "Take prescribed nitrates as directed",
      "Avoid heavy meals and extreme temperatures",
      "Report increasing frequency or severity of chest pain",
    ],
  },
  "Enlarged Heart": {
    aliases: ["cardiomegaly", "big heart"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 20,
    specialists: ["Cardiologist"],
    labTests: ["Echocardiogram", "Chest X-ray", "ECG"],
    recommendations: [
      "Investigate underlying cause (hypertension, valve disease, etc.)",
      "Regular echocardiogram monitoring",
    ],
  },
  "Peripheral Artery Disease": {
    aliases: ["pad", "peripheral vascular disease", "poor circulation legs"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 18,
    specialists: ["Vascular Surgeon", "Cardiologist"],
    labTests: ["Ankle-Brachial Index (ABI)", "Doppler Ultrasound", "Lipid Profile"],
    recommendations: [
      "Supervised walking program",
      "Strict foot care; inspect daily",
      "Take antiplatelet and statin therapy",
    ],
  },
  "Atherosclerosis": {
    aliases: ["hardening of arteries", "arterial plaque"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 20,
    specialists: ["Cardiologist", "Vascular Surgeon"],
    labTests: ["Lipid Profile", "Carotid Ultrasound", "CT Coronary Angiography"],
    recommendations: [
      "Aggressive lipid lowering with statins",
      "Blood pressure and diabetes control",
      "Smoking cessation if applicable",
    ],
  },
  "High Cholesterol": {
    aliases: ["hyperlipidemia", "high lipid", "mataas cholesterol", "dyslipidemia"],
    category: CLINICAL_CATEGORIES.CARDIOVASCULAR,
    weight: 15,
    specialists: ["Cardiologist", "Endocrinologist"],
    labTests: ["Lipid Profile", "Liver Function Test"],
    recommendations: [
      "Diet low in saturated fat and trans fat",
      "Regular exercise (150 min/week moderate intensity)",
      "Consider statin therapy if indicated",
    ],
  },

  // ── METABOLIC ──
  "Diabetes": {
    aliases: ["sugar", "diabetes mellitus", "dm", "high blood sugar", "mataas sugar", "mahilig matamis"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 30,
    specialists: ["Endocrinologist", "Internal Medicine"],
    labTests: ["HbA1c", "Fasting Blood Glucose", "Oral Glucose Tolerance Test", "Microalbuminuria"],
    recommendations: [
      "Monitor blood glucose regularly",
      "Take hypoglycemic medications/insulin as prescribed",
      "Annual eye exam and foot exam",
      "HbA1c target <7% (individualize with physician)",
    ],
  },
  "Type 1 Diabetes": {
    aliases: ["t1dm", "juvenile diabetes", "insulin-dependent diabetes"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 32,
    specialists: ["Endocrinologist", "Diabetes Educator"],
    labTests: ["HbA1c", "Fasting Blood Glucose", "C-Peptide", "Autoantibody Panel"],
    recommendations: [
      "Strict insulin regimen adherence",
      "Carbohydrate counting education",
      "Frequent glucose monitoring",
    ],
  },
  "Type 2 Diabetes": {
    aliases: ["t2dm", "adult-onset diabetes", "non-insulin-dependent diabetes"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 30,
    specialists: ["Endocrinologist", "Internal Medicine"],
    labTests: ["HbA1c", "Fasting Blood Glucose", "Lipid Profile", "Kidney Function Test"],
    recommendations: [
      "Weight management and regular exercise",
      "Oral hypoglycemics/insulin as prescribed",
      "Annual complication screening (eyes, kidneys, feet)",
    ],
  },
  "Prediabetes": {
    aliases: ["borderline diabetes", "impaired glucose tolerance", "impaired fasting glucose"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 15,
    specialists: ["Internal Medicine", "Endocrinologist"],
    labTests: ["HbA1c", "Fasting Blood Glucose", "Oral Glucose Tolerance Test"],
    recommendations: [
      "Lifestyle intervention: 5–7% weight loss if overweight",
      "150 minutes/week moderate physical activity",
      "Annual glucose monitoring",
    ],
  },
  "Obesity": {
    aliases: ["sobrang taba", "overweight severe", "morbid obesity", "bmi 30+"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 20,
    specialists: ["Endocrinologist", "Bariatric Surgeon", "Dietitian"],
    labTests: ["Lipid Profile", "Fasting Blood Glucose", "Liver Function Test", "Thyroid Function Test"],
    recommendations: [
      "Target 5–10% weight loss over 6 months",
      "Calorie-controlled diet with dietitian guidance",
      "Gradual increase to 150–300 min/week physical activity",
    ],
  },
  "Overweight": {
    aliases: ["medyo mataba", "chubby", "bmi 25–29.9"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 10,
    specialists: ["Internal Medicine", "Dietitian"],
    labTests: ["Lipid Profile", "Fasting Blood Glucose", "Liver Function Test"],
    recommendations: [
      "Aim for gradual weight loss through diet and exercise",
      "Portion control and reduce sugary beverages",
    ],
  },
  "Malnutrition": {
    aliases: ["underweight", "nutritional deficiency", "kulang sa sustansya"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 12,
    specialists: ["Dietitian", "Internal Medicine"],
    labTests: ["Complete Blood Count (CBC)", "Serum Albumin", "Vitamin D", "Vitamin B12"],
    recommendations: [
      "Nutritional assessment and supplementation",
      "Balanced diet with adequate protein intake",
    ],
  },
  "Fatty Liver": {
    aliases: ["nafld", "non-alcoholic fatty liver", "hepatic steatosis", "sakit sa atay"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 15,
    specialists: ["Gastroenterologist", "Hepatologist"],
    labTests: ["Liver Function Test", "Abdominal Ultrasound", "HbA1c", "Lipid Profile"],
    recommendations: [
      "Weight loss of 7–10% if overweight",
      "Avoid alcohol and high-fructose foods",
      "Manage diabetes and dyslipidemia",
    ],
  },
  "Thyroid Disease": {
    aliases: ["sakit sa thyroid", "goiter", "thyroid problem"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 12,
    specialists: ["Endocrinologist"],
    labTests: ["TSH", "Free T4", "Free T3", "Thyroid Antibodies", "Thyroid Ultrasound"],
    recommendations: [
      "Regular thyroid function monitoring",
      "Take thyroid medications as prescribed",
    ],
  },
  "Hyperthyroidism": {
    aliases: ["overactive thyroid", "graves disease", "toxic goiter"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 14,
    specialists: ["Endocrinologist"],
    labTests: ["TSH", "Free T4", "Free T3", "Thyroid Antibodies", "Radioactive Iodine Uptake"],
    recommendations: [
      "Antithyroid medications or radioactive iodine as prescribed",
      "Monitor heart rate and weight",
    ],
  },
  "Hypothyroidism": {
    aliases: ["underactive thyroid", "hashimoto thyroiditis"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 10,
    specialists: ["Endocrinologist"],
    labTests: ["TSH", "Free T4", "Thyroid Antibodies"],
    recommendations: [
      "Levothyroxine replacement therapy",
      "Monitor TSH every 6–12 months",
    ],
  },
  "Gout": {
    aliases: ["rayuma", "sakit sa paa", "uric acid", "hyperuricemia", "podagra"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 10,
    specialists: ["Rheumatologist", "Internal Medicine"],
    labTests: ["Serum Uric Acid", "Kidney Function Test", "Joint X-ray", "Joint Fluid Analysis"],
    recommendations: [
      "Limit purine-rich foods (organ meats, shellfish, alcohol)",
      "Stay well hydrated",
      "Take urate-lowering therapy as prescribed",
    ],
  },
  "Metabolic Syndrome": {
    aliases: ["insulin resistance syndrome", "syndrome x"],
    category: CLINICAL_CATEGORIES.METABOLIC,
    weight: 22,
    specialists: ["Endocrinologist", "Cardiologist"],
    labTests: ["HbA1c", "Lipid Profile", "Blood Pressure Monitoring", "Waist Circumference"],
    recommendations: [
      "Aggressive lifestyle modification",
      "Weight loss and regular exercise",
      "Manage all components (BP, glucose, lipids)",
    ],
  },

  // ── RESPIRATORY ──
  "Asthma": {
    aliases: ["hika", "shortness of breath", "wheezing", "bronchial asthma"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 12,
    specialists: ["Pulmonologist", "Allergist"],
    labTests: ["Pulmonary Function Test (Spirometry)", "Chest X-ray", "Allergy Testing"],
    recommendations: [
      "Use inhalers (controller + reliever) as prescribed",
      "Identify and avoid triggers (dust, pollen, smoke)",
      "Have an asthma action plan",
    ],
  },
  "COPD": {
    aliases: ["chronic obstructive pulmonary disease", "emphysema", "chronic bronchitis combined"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 25,
    specialists: ["Pulmonologist"],
    labTests: ["Pulmonary Function Test", "Chest X-ray", "CT Chest", "Arterial Blood Gas"],
    recommendations: [
      "Smoking cessation is critical",
      "Use bronchodilators and inhaled corticosteroids",
      "Annual flu and pneumococcal vaccines",
    ],
  },
  "Pneumonia": {
    aliases: ["pulmonya", "lung infection", "chest infection"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 15,
    specialists: ["Pulmonologist", "Infectious Disease Specialist"],
    labTests: ["Chest X-ray", "Complete Blood Count (CBC)", "Sputum Culture", "Blood Culture"],
    recommendations: [
      "Complete full course of antibiotics",
      "Rest and adequate hydration",
      "Follow-up chest X-ray after recovery",
    ],
  },
  "Tuberculosis": {
    aliases: ["tb", "pulmonary tb", "kochs infection", "sakit sa baga"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 20,
    specialists: ["Pulmonologist", "Infectious Disease Specialist"],
    labTests: ["Chest X-ray", "Sputum AFB Smear", "GeneXpert MTB/RIF", "TB Culture"],
    recommendations: [
      "Complete 6-month DOTS therapy without interruption",
      "Regular sputum monitoring",
      "Isolate if active and follow infection control",
    ],
  },
  "Chronic Bronchitis": {
    aliases: ["persistent cough", "productive cough", "long-term bronchitis"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 18,
    specialists: ["Pulmonologist"],
    labTests: ["Pulmonary Function Test", "Chest X-ray", "Sputum Analysis"],
    recommendations: [
      "Avoid smoking and air pollutants",
      "Use prescribed bronchodilators",
      "Pulmonary rehabilitation if severe",
    ],
  },
  "Emphysema": {
    aliases: ["damaged air sacs", "destroyed alveoli"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 22,
    specialists: ["Pulmonologist"],
    labTests: ["Pulmonary Function Test", "CT Chest", "Alpha-1 Antitrypsin"],
    recommendations: [
      "Smoking cessation immediately",
      "Long-acting bronchodilators",
      "Oxygen therapy if indicated",
    ],
  },
  "Sleep Apnea": {
    aliases: ["obstructive sleep apnea", "osa", "snoring with pauses", "hirap matulog"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 15,
    specialists: ["Pulmonologist", "Sleep Specialist", "ENT"],
    labTests: ["Polysomnography (Sleep Study)", "Pulse Oximetry"],
    recommendations: [
      "CPAP therapy if prescribed",
      "Weight loss if overweight",
      "Sleep on side; avoid alcohol before bed",
    ],
  },
  "Allergic Rhinitis": {
    aliases: ["allergies", "hay fever", "sinisipon", "sneezing fits"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 6,
    specialists: ["Allergist", "ENT"],
    labTests: ["Allergy Testing", "Nasal Endoscopy"],
    recommendations: [
      "Avoid known allergens",
      "Intranasal corticosteroids and antihistamines",
      "Saline nasal rinses",
    ],
  },
  "Sinusitis": {
    aliases: ["sinus infection", "pananakit ng ulo", "sinus problem"],
    category: CLINICAL_CATEGORIES.RESPIRATORY,
    weight: 8,
    specialists: ["ENT"],
    labTests: ["CT Paranasal Sinuses", "Nasal Endoscopy"],
    recommendations: [
      "Antibiotics if bacterial (10–14 days)",
      "Nasal saline irrigation",
      "Decongestants for short-term use only",
    ],
  },

  // ── RENAL ──
  "CKD": {
    aliases: ["chronic kidney disease", "kidney damage", "sakit sa bato", "kidney problem chronic"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 30,
    specialists: ["Nephrologist"],
    labTests: ["Serum Creatinine", "eGFR", "Urinalysis", "Kidney Ultrasound", "Electrolytes"],
    recommendations: [
      "Blood pressure target <130/80",
      "Avoid nephrotoxic drugs (NSAIDs, contrast dye)",
      "Protein restriction if advanced CKD",
      "Nephrology follow-up every 3–6 months",
    ],
  },
  "Kidney Disease": {
    aliases: ["renal disease", "nephropathy", "kidney disorder"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 25,
    specialists: ["Nephrologist"],
    labTests: ["Serum Creatinine", "eGFR", "Urinalysis", "Kidney Ultrasound"],
    recommendations: [
      "Monitor kidney function regularly",
      "Control blood pressure and blood sugar",
      "Stay hydrated; limit sodium",
    ],
  },
  "Kidney Failure": {
    aliases: ["renal failure", "end-stage renal disease", "esrd", "kidney shut down"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 35,
    specialists: ["Nephrologist", "Transplant Surgeon"],
    labTests: ["Serum Creatinine", "eGFR", "Electrolytes", "CBC", "Parathyroid Hormone"],
    recommendations: [
      "Dialysis or transplant evaluation",
      "Strict fluid, potassium, and phosphate restrictions",
      "Anemia and bone disease management",
    ],
  },
  "Kidney Stones": {
    aliases: ["nephrolithiasis", "renal calculi", "bato sa bato", "urinary stones"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 12,
    specialists: ["Urologist", "Nephrologist"],
    labTests: ["CT KUB (Non-contrast)", "Urinalysis", "Kidney Ultrasound", "Stone Analysis"],
    recommendations: [
      "Increase fluid intake to >2.5L/day",
      "Dietary modifications based on stone type",
      "Pain management and stone removal if obstructing",
    ],
  },
  "UTI": {
    aliases: ["urinary tract infection", "cystitis", "pyelonephritis", "imbesyon sa ihi"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 8,
    specialists: ["Urologist", "Nephrologist"],
    labTests: ["Urinalysis", "Urine Culture", "Kidney Ultrasound"],
    recommendations: [
      "Complete antibiotic course",
      "Increase fluid intake",
      "Cranberry products may help prevent recurrence",
    ],
  },
  "Enlarged Prostate": {
    aliases: ["benign prostatic hyperplasia", "bph", "prostate enlargement"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 12,
    specialists: ["Urologist"],
    labTests: ["PSA Test", "Transrectal Ultrasound", "Uroflowmetry", "Post-void Residual"],
    recommendations: [
      "Alpha-blockers or 5-alpha reductase inhibitors",
      "Monitor PSA and urinary symptoms",
      "Surgical evaluation if severe obstruction",
    ],
  },
  "Prostate": {
    aliases: ["prostate problem", "prostate issue", "prostatitis"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 12,
    specialists: ["Urologist"],
    labTests: ["PSA Test", "Transrectal Ultrasound", "Urine Culture"],
    recommendations: [
      "Urology evaluation for diagnosis",
      "Antibiotics if prostatitis",
      "Monitor PSA trends",
    ],
  },
  "Dialysis History": {
    aliases: ["hemodialysis", "peritoneal dialysis", "dialysis patient", "nagses dialysis"],
    category: CLINICAL_CATEGORIES.RENAL,
    weight: 40,
    specialists: ["Nephrologist", "Dialysis Nurse"],
    labTests: ["Serum Creatinine", "eGFR", "Electrolytes", "CBC", "PTH"],
    recommendations: [
      "Strict adherence to dialysis schedule",
      "Fluid and diet restrictions per dialysis team",
      "Vascular access care and monitoring",
    ],
  },

  // ── NEUROLOGICAL ──
  "Epilepsy": {
    aliases: ["seizure disorder", "fits", "convulsions", "kinukuryente"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 18,
    specialists: ["Neurologist"],
    labTests: ["EEG", "MRI Brain", "Serum Antiepileptic Drug Levels"],
    recommendations: [
      "Take antiepileptic medications consistently; never skip doses",
      "Avoid seizure triggers (sleep deprivation, alcohol, flashing lights)",
      "Do not drive until seizure-free for required period",
    ],
  },
  "Seizure Disorder": {
    aliases: ["recurrent seizures", "seizure epilepsy"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 18,
    specialists: ["Neurologist"],
    labTests: ["EEG", "MRI Brain"],
    recommendations: [
      "Adherence to antiepileptic drug regimen",
      "Emergency seizure action plan for family/caregivers",
    ],
  },
  "Migraine": {
    aliases: ["severe headache", "sakit ng ulo", "chronic headache", "nauulit na headache"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 10,
    specialists: ["Neurologist"],
    labTests: ["MRI Brain (if red flags)", "CT Brain (if acute)"],
    recommendations: [
      "Identify and avoid triggers (certain foods, stress, sleep changes)",
      "Acute triptan therapy; preventive medications if chronic",
    ],
  },
  "Parkinson’s Disease": {
    aliases: ["parkinsonism", "tremor disorder", "shaking palsy"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 22,
    specialists: ["Neurologist", "Movement Disorder Specialist"],
    labTests: ["MRI Brain", "DaTscan"],
    recommendations: [
      "Levodopa and dopamine agonists as prescribed",
      "Physical and speech therapy",
      "Fall prevention strategies",
    ],
  },
  "Alzheimer’s Disease": {
    aliases: ["alzheimers", "dementia alzheimer type", "memory loss severe"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 25,
    specialists: ["Neurologist", "Geriatrician", "Psychiatrist"],
    labTests: ["MRI Brain", "Cognitive Testing (MMSE/MoCA)", "Vitamin B12", "TSH"],
    recommendations: [
      "Cholinesterase inhibitors or memantine",
      "Cognitive stimulation activities",
      "Caregiver support and safety planning",
    ],
  },
  "Dementia": {
    aliases: ["memory impairment", "cognitive decline", "nakakalimot"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 25,
    specialists: ["Neurologist", "Geriatrician", "Psychiatrist"],
    labTests: ["MRI Brain", "Cognitive Testing", "Vitamin B12", "TSH", "Syphilis Serology"],
    recommendations: [
      "Comprehensive cognitive and functional assessment",
      "Treat reversible causes (B12 deficiency, hypothyroidism, depression)",
      "Safety planning and caregiver education",
    ],
  },
  "Neuropathy": {
    aliases: ["nerve damage", "peripheral neuropathy", "namamanhid", "burning feet"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 12,
    specialists: ["Neurologist"],
    labTests: ["Nerve Conduction Study", "EMG", "Vitamin B12", "HbA1c"],
    recommendations: [
      "Treat underlying cause (diabetes, B12 deficiency, alcohol)",
      "Neuropathic pain medications (gabapentin, pregabalin)",
      "Foot care and fall prevention",
    ],
  },
  "Bell’s Palsy": {
    aliases: ["facial paralysis", "facial nerve palsy", "namatay na mukha"],
    category: CLINICAL_CATEGORIES.NEUROLOGICAL,
    weight: 6,
    specialists: ["Neurologist", "ENT"],
    labTests: ["MRI Brain (to rule out stroke)"],
    recommendations: [
      "Oral corticosteroids within 72 hours",
      "Eye protection (lubricating drops, tape at night)",
      "Facial physiotherapy",
    ],
  },

  // ── MENTAL HEALTH ──
  "Anxiety": {
    aliases: ["nervousness", "worry", "panic", "kinakabahan", "pagkabalisa"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 10,
    specialists: ["Psychiatrist", "Psychologist"],
    labTests: ["Thyroid Function Test", "CBC", "Comprehensive Metabolic Panel"],
    recommendations: [
      "Cognitive Behavioral Therapy (CBT)",
      "Relaxation techniques and mindfulness",
      "Consider SSRI/SNRI if severe",
    ],
  },
  "Depression": {
    aliases: ["sadness", "low mood", "clinical depression", "pagkawala ng gana", "lungkot"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 12,
    specialists: ["Psychiatrist", "Psychologist"],
    labTests: ["Thyroid Function Test", "Vitamin D", "CBC", "Comprehensive Metabolic Panel"],
    recommendations: [
      "Psychotherapy (CBT, IPT)",
      "Antidepressants if moderate-severe",
      "Regular sleep schedule and physical activity",
      "Suicide risk screening if severe",
    ],
  },
  "Bipolar Disorder": {
    aliases: ["manic depression", "mood swings severe", "bipolar"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 18,
    specialists: ["Psychiatrist"],
    labTests: ["Thyroid Function Test", "CBC", "Comprehensive Metabolic Panel", "Drug Screen"],
    recommendations: [
      "Mood stabilizers (lithium, valproate, lamotrigine)",
      "Regular mood tracking and sleep hygiene",
      "Substance use screening and management",
    ],
  },
  "Schizophrenia": {
    aliases: ["psychosis", "severe mental illness", "hallucinations", "delusions"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 20,
    specialists: ["Psychiatrist"],
    labTests: ["CBC", "Comprehensive Metabolic Panel", "Drug Screen", "MRI Brain"],
    recommendations: [
      "Antipsychotic medications consistently",
      "Early intervention and family psychoeducation",
      "Vocational and social rehabilitation",
    ],
  },
  "Panic Disorder": {
    aliases: ["panic attacks", "sudden fear", "namamatay pakiramdam"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 14,
    specialists: ["Psychiatrist", "Psychologist"],
    labTests: ["Thyroid Function Test", "ECG", "CBC"],
    recommendations: [
      "CBT with panic-focused exposure",
      "SSRIs or SNRIs for prevention",
      "Breathing techniques and grounding exercises",
    ],
  },
  "PTSD": {
    aliases: ["post-traumatic stress", "trauma", "flashbacks", "nightmares trauma"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 15,
    specialists: ["Psychiatrist", "Psychologist", "Trauma Therapist"],
    labTests: ["No specific labs; clinical diagnosis"],
    recommendations: [
      "Trauma-focused CBT or EMDR",
      "SSRIs for intrusive symptoms and depression",
      "Safety planning and social support",
    ],
  },
  "Stress Disorder": {
    aliases: ["acute stress", "adjustment disorder", "chronic stress", "sobrang stress"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 7,
    specialists: ["Psychiatrist", "Psychologist"],
    labTests: ["Cortisol (optional)", "Thyroid Function Test"],
    recommendations: [
      "Stress management techniques",
      "Sleep hygiene improvement",
      "Consider short-term counseling",
    ],
  },
  "Insomnia": {
    aliases: ["sleeplessness", "difficulty sleeping", "hirap matulog", "puyat"],
    category: CLINICAL_CATEGORIES.MENTAL,
    weight: 8,
    specialists: ["Sleep Specialist", "Psychiatrist"],
    labTests: ["Polysomnography (if complex)", "Thyroid Function Test"],
    recommendations: [
      "Sleep hygiene: consistent bedtime, no screens 1 hour before bed",
      "CBT for Insomnia (CBT-I)",
      "Avoid caffeine after noon",
    ],
  },

  // ── ONCOLOGY ──
  "Cancer": {
    aliases: ["malignancy", "tumor", "neoplasm", "cancerous", "kanser"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 35,
    specialists: ["Oncologist"],
    labTests: ["Tumor Markers", "Biopsy", "Imaging (CT/MRI/PET)", "CBC"],
    recommendations: [
      "Oncology referral for staging and treatment plan",
      "Multidisciplinary tumor board discussion",
      "Psychosocial support and palliative care as needed",
    ],
  },
  "Breast Cancer": {
    aliases: ["breast tumor", "breast malignancy", "cancer sa dede"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 30,
    specialists: ["Oncologist", "Breast Surgeon", "Radiation Oncologist"],
    labTests: ["Mammography", "Breast Ultrasound", "Biopsy", "BRCA Testing (if indicated)"],
    recommendations: [
      "Surgical oncology evaluation",
      "Genetic counseling if family history present",
      "Regular breast self-exam and imaging surveillance",
    ],
  },
  "Lung Cancer": {
    aliases: ["pulmonary malignancy", "cancer sa baga"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 40,
    specialists: ["Oncologist", "Thoracic Surgeon", "Pulmonologist"],
    labTests: ["Chest CT", "PET-CT", "Bronchoscopy with Biopsy", "Molecular Testing"],
    recommendations: [
      "Smoking cessation immediately",
      "Staging workup and multidisciplinary discussion",
      "Targeted therapy or immunotherapy if molecular markers positive",
    ],
  },
  "Colon Cancer": {
    aliases: ["colorectal cancer", "bowel cancer", "cancer sa bituka"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 32,
    specialists: ["Oncologist", "Colorectal Surgeon"],
    labTests: ["Colonoscopy", "CT Chest/Abdomen/Pelvis", "CEA Tumor Marker", "Biopsy"],
    recommendations: [
      "Colonoscopy with biopsy for diagnosis",
      "Staging CT and surgical evaluation",
      "Regular colonoscopy surveillance post-treatment",
    ],
  },
  "Liver Cancer": {
    aliases: ["hepatocellular carcinoma", "hcc", "cancer sa atay"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 38,
    specialists: ["Oncologist", "Hepatologist", "Transplant Surgeon"],
    labTests: ["Alpha-fetoprotein (AFP)", "CT/MRI Liver", "Liver Biopsy", "HBV/HCV Screening"],
    recommendations: [
      "Hepatology and oncology co-management",
      "HCC surveillance every 6 months if cirrhosis",
      "Transplant evaluation if eligible",
    ],
  },
  "Cervical Cancer": {
    aliases: ["cancer cervix", "cancer sa matris"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 30,
    specialists: ["Gynecologic Oncologist"],
    labTests: ["Pap Smear", "HPV Testing", "Colposcopy", "Biopsy"],
    recommendations: [
      "HPV vaccination for eligible contacts",
      "Regular Pap smear/HPV co-testing",
      "Gynecologic oncology referral for treatment",
    ],
  },
  "Prostate Cancer": {
    aliases: ["cancer prostate", "cancer sa prostate"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 25,
    specialists: ["Urologist", "Radiation Oncologist", "Medical Oncologist"],
    labTests: ["PSA", "Multiparametric MRI", "Prostate Biopsy", "Bone Scan"],
    recommendations: [
      "Urology referral for risk stratification",
      "Active surveillance vs. treatment based on Gleason score",
      "Bone health monitoring if on androgen deprivation",
    ],
  },
  "Leukemia": {
    aliases: ["blood cancer", "cancer sa dugo"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 38,
    specialists: ["Hematologist-Oncologist"],
    labTests: ["Complete Blood Count (CBC)", "Peripheral Blood Smear", "Bone Marrow Biopsy", "Flow Cytometry"],
    recommendations: [
      "Urgent hematology-oncology referral",
      "Infection prophylaxis and transfusion support",
      "Consider stem cell transplant evaluation",
    ],
  },
  "Thyroid Cancer": {
    aliases: ["cancer sa thyroid", "thyroid malignancy"],
    category: CLINICAL_CATEGORIES.ONCOLOGY,
    weight: 22,
    specialists: ["Endocrinologist", "Oncologist", "Head and Neck Surgeon"],
    labTests: ["Thyroid Ultrasound", "Fine Needle Aspiration (FNA)", "Thyroglobulin", "Neck CT"],
    recommendations: [
      "Thyroidectomy and possible radioactive iodine",
      "Lifelong levothyroxine suppression therapy",
      "Regular thyroglobulin and neck ultrasound surveillance",
    ],
  },

  // ── REPRODUCTIVE ──
  "Pregnancy": {
    aliases: ["pregnant", "buntis", "expecting", "carrying a child"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 10,
    specialists: ["Obstetrician-Gynecologist", "Midwife"],
    labTests: ["Urinary hCG", "Serum hCG", "Ultrasound", "CBC", "Blood Type and Screen"],
    recommendations: [
      "Regular prenatal visits",
      "Folic acid supplementation",
      "Avoid alcohol, smoking, and raw foods",
    ],
  },
  "High Risk Pregnancy": {
    aliases: ["complicated pregnancy", "buntis may komplikasyon", "mataas panganib"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 25,
    specialists: ["Maternal-Fetal Medicine Specialist", "Obstetrician-Gynecologist"],
    labTests: ["Ultrasound (Serial)", "Glucose Challenge Test", "CBC", "Coagulation Profile"],
    recommendations: [
      "Frequent prenatal monitoring",
      "Manage comorbidities (diabetes, hypertension)",
      "Delivery planning at equipped facility",
    ],
  },
  "Abortion": {
    aliases: ["abortion history", "miscarriage induced", "pregnancy loss induced"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 10,
    specialists: ["Obstetrician-Gynecologist"],
    labTests: ["Ultrasound", "CBC", "RH Type"],
    recommendations: [
      "Post-procedure follow-up and contraception counseling",
      "Screen for infection or retained tissue",
      "Mental health support if needed",
    ],
  },
  "Miscarriage": {
    aliases: ["spontaneous abortion", "pregnancy loss", "nagka-miscarriage", "nawala bata"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 12,
    specialists: ["Obstetrician-Gynecologist"],
    labTests: ["Ultrasound", "CBC", "Serial hCG"],
    recommendations: [
      "Ensure complete evacuation of products",
      "RH immunoglobulin if Rh-negative",
      "Grief counseling and preconception evaluation",
    ],
  },
  "PCOS": {
    aliases: ["polycystic ovary syndrome", "polycystic ovaries", "irregular periods hormonal"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 14,
    specialists: ["Obstetrician-Gynecologist", "Endocrinologist"],
    labTests: ["Testosterone", "LH/FSH Ratio", "Ultrasound Ovaries", "Glucose/Insulin", "Lipid Profile"],
    recommendations: [
      "Weight management and exercise",
      "Metformin if insulin resistant",
      "Hormonal contraception for cycle regulation",
    ],
  },
  "Endometriosis": {
    aliases: ["sakit sa obaryo", "dysmenorrhea severe", "endometrial implants"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 14,
    specialists: ["Obstetrician-Gynecologist"],
    labTests: ["Transvaginal Ultrasound", "MRI Pelvis", "CA-125 (optional)"],
    recommendations: [
      "Hormonal therapy (OCPs, progestins, GnRH agonists)",
      "Pain management with NSAIDs",
      "Surgical evaluation if refractory",
    ],
  },
  "Menopause": {
    aliases: ["menopausal", "postmenopausal", "hot flashes", "pagkapagpala"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 6,
    specialists: ["Obstetrician-Gynecologist"],
    labTests: ["FSH", "Estradiol", "Bone Density (DEXA)"],
    recommendations: [
      "Hormone replacement therapy if symptomatic and no contraindications",
      "Calcium and vitamin D for bone health",
      "Cardiovascular risk assessment",
    ],
  },
  "Gestational Diabetes": {
    aliases: ["pregnancy diabetes", "gdm", "diabetes buntis"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 18,
    specialists: ["Obstetrician-Gynecologist", "Endocrinologist"],
    labTests: ["Oral Glucose Tolerance Test", "HbA1c", "Fetal Ultrasound (Growth)"],
    recommendations: [
      "Blood glucose monitoring 4x daily",
      "Dietitian referral for meal planning",
      "Insulin if glucose targets not met with diet",
    ],
  },
  "Preeclampsia": {
    aliases: ["pregnancy hypertension", "toxemia", "high bp buntis"],
    category: CLINICAL_CATEGORIES.REPRODUCTIVE,
    weight: 25,
    specialists: ["Maternal-Fetal Medicine Specialist", "Obstetrician-Gynecologist"],
    labTests: ["Blood Pressure Monitoring", "Urinalysis (Protein)", "Liver Function Test", "CBC", "Creatinine"],
    recommendations: [
      "Close BP and proteinuria monitoring",
      "Magnesium sulfate if severe features",
      "Delivery timing based on gestational age and severity",
    ],
  },

  // ── INFECTIOUS ──
  "Dengue": {
    aliases: ["dengue fever", "breakbone fever", "dengue hemorrhagic fever", "dhf"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 18,
    specialists: ["Infectious Disease Specialist", "Internal Medicine"],
    labTests: ["NS1 Antigen", "Dengue IgM/IgG", "CBC", "Liver Function Test"],
    recommendations: [
      "Adequate hydration; oral rehydration or IV if severe",
      "Monitor for warning signs (abdominal pain, bleeding, lethargy)",
      "Avoid NSAIDs and aspirin (bleeding risk)",
    ],
  },
  "COVID-19": {
    aliases: ["coronavirus", "sars-cov-2", "covid", "covid infection"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 15,
    specialists: ["Infectious Disease Specialist", "Pulmonologist"],
    labTests: ["RT-PCR", "Chest X-ray", "CBC", "CRP", "D-dimer"],
    recommendations: [
      "Isolation per local protocols",
      "Monitor oxygen saturation; seek care if <94%",
      "Vaccination and boosters as eligible",
    ],
  },
  "Hepatitis": {
    aliases: ["liver inflammation", "viral hepatitis", "hepa", "sakit sa atay infectious"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 20,
    specialists: ["Hepatologist", "Gastroenterologist", "Infectious Disease Specialist"],
    labTests: ["Hepatitis B Surface Antigen", "Hepatitis C Antibody", "Liver Function Test", "HBV DNA / HCV RNA"],
    recommendations: [
      "Antiviral therapy if chronic HBV/HCV",
      "Liver cancer surveillance if cirrhosis",
      "Vaccinate contacts against Hepatitis A and B",
    ],
  },
  "HIV/AIDS": {
    aliases: ["hiv", "aids", "human immunodeficiency virus", "acquired immunodeficiency syndrome"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 30,
    specialists: ["Infectious Disease Specialist", "HIV Specialist"],
    labTests: ["HIV Antigen/Antibody", "CD4 Count", "Viral Load", "Resistance Testing"],
    recommendations: [
      "Immediate ART initiation (U=U when virally suppressed)",
      "Opportunistic infection prophylaxis based on CD4",
      "Regular CD4 and viral load monitoring",
    ],
  },
  "Typhoid Fever": {
    aliases: ["typhoid", "enteric fever", "salmonella typhi"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 16,
    specialists: ["Infectious Disease Specialist", "Internal Medicine"],
    labTests: ["Blood Culture", "Widal Test", "Typhidot", "CBC"],
    recommendations: [
      "Complete antibiotic course (azithromycin or fluoroquinolone)",
      "Safe food and water hygiene",
      "Vaccination for high-risk travel",
    ],
  },
  "Leptospirosis": {
    aliases: ["lepto", "rat urine disease", "weil disease", "sakit dala ng baha"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 18,
    specialists: ["Infectious Disease Specialist", "Nephrologist"],
    labTests: ["Leptospira IgM", "Blood Culture", "CBC", "Kidney Function Test", "Liver Function Test"],
    recommendations: [
      "Doxycycline or penicillin early in course",
      "Monitor for kidney and liver failure",
      "Avoid wading in floodwaters; wear protective footwear",
    ],
  },
  "Chickenpox": {
    aliases: ["varicella", "bulutong", "water pox"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 8,
    specialists: ["Infectious Disease Specialist", "Dermatologist"],
    labTests: ["Varicella PCR", "Tzanck Smear (rarely needed)"],
    recommendations: [
      "Antihistamines and calamine lotion for itching",
      "Acyclovir if severe or immunocompromised",
      "Isolation until all lesions crusted",
    ],
  },
  "Measles": {
    aliases: ["rubeola", "tigdas", "morbillivirus"],
    category: CLINICAL_CATEGORIES.INFECTIOUS,
    weight: 12,
    specialists: ["Infectious Disease Specialist", "Pediatrician"],
    labTests: ["Measles IgM", "RT-PCR (Nasopharyngeal)"],
    recommendations: [
      "Supportive care and vitamin A supplementation",
      "Isolation for 4 days after rash onset",
      "MMR vaccination for contacts and community",
    ],
  },

  // ── MUSCULOSKELETAL ──
  "Arthritis": {
    aliases: ["joint inflammation", "sakit sa kasuksuan", "painful joints"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 10,
    specialists: ["Rheumatologist", "Orthopedic Surgeon"],
    labTests: ["Rheumatoid Factor", "Anti-CCP", "CRP", "ESR", "X-ray Joints"],
    recommendations: [
      "NSAIDs and disease-modifying antirheumatic drugs (DMARDs)",
      "Joint protection and physiotherapy",
    ],
  },
  "Osteoarthritis": {
    aliases: ["degenerative arthritis", "wear and tear arthritis", "sakit sa tuhod"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 10,
    specialists: ["Orthopedic Surgeon", "Rheumatologist"],
    labTests: ["X-ray Joints", "MRI (if soft tissue involvement)"],
    recommendations: [
      "Weight loss if overweight",
      "Low-impact exercise (swimming, cycling)",
      "Joint replacement if end-stage",
    ],
  },
  "Osteoporosis": {
    aliases: ["brittle bones", "weak bones", "bone loss", "pagka-pangang ng buto"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 12,
    specialists: ["Endocrinologist", "Rheumatologist"],
    labTests: ["DEXA Scan", "Calcium", "Vitamin D", "PTH"],
    recommendations: [
      "Calcium 1,200mg + Vitamin D 800–1,000 IU daily",
      "Bisphosphonates or denosumab if indicated",
      "Fall prevention and weight-bearing exercise",
    ],
  },
  "Scoliosis": {
    aliases: ["curved spine", "crooked back", "sakit sa likod baluktot"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 6,
    specialists: ["Orthopedic Surgeon", "Physiatrist"],
    labTests: ["Spine X-ray (Cobb angle)", "MRI (if neurological signs)"],
    recommendations: [
      "Bracing if curve 25–40 degrees in growing child",
      "Surgical correction if curve >45–50 degrees",
      "Scoliosis-specific physiotherapy",
    ],
  },
  "Chronic Back Pain": {
    aliases: ["lower back pain", "lumbar pain", "sakit sa likod", "persistent backache"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 8,
    specialists: ["Physiatrist", "Orthopedic Surgeon", "Pain Specialist"],
    labTests: ["Lumbar X-ray", "MRI Lumbar Spine", "CT (if surgical planning)"],
    recommendations: [
      "Core strengthening and flexibility exercises",
      "Ergonomics and posture correction",
      "Multimodal pain management (NSAIDs, physical therapy, injections)",
    ],
  },
  "Joint Pain": {
    aliases: ["arthralgia", "sakit sa joints", "painful joints"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 6,
    specialists: ["Rheumatologist", "Orthopedic Surgeon"],
    labTests: ["X-ray Joints", "CRP", "ESR", "Uric Acid"],
    recommendations: [
      "Rest affected joints; apply ice/heat",
      "NSAIDs for short-term relief",
      "Rheumatology evaluation if persistent >6 weeks",
    ],
  },
  "Rheumatism": {
    aliases: ["rayuma", "rheumatic disease", "rheumatic pain"],
    category: CLINICAL_CATEGORIES.MUSCULOSKELETAL,
    weight: 10,
    specialists: ["Rheumatologist"],
    labTests: ["Rheumatoid Factor", "Anti-CCP", "CRP", "ESR", "ANA"],
    recommendations: [
      "Early rheumatology referral for diagnosis",
      "DMARDs if inflammatory arthritis confirmed",
    ],
  },

  // ── LIFESTYLE ──
  "Smoking": {
    aliases: ["smoker", "cigarette use", "tobacco", "yosi", "sigarilyo"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 15,
    specialists: ["Pulmonologist", "Internal Medicine"],
    labTests: ["Spirometry", "Chest X-ray", "Lipid Profile"],
    recommendations: [
      "Smoking cessation is the single most impactful change",
      "Consider nicotine replacement or varenicline",
      "Annual low-dose CT lung cancer screening if age 50–80 with 20 pack-year history",
    ],
  },
  "Vape Use": {
    aliases: ["vaping", "e-cigarette", "electronic cigarette", "pod", "juul"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 10,
    specialists: ["Pulmonologist"],
    labTests: ["Spirometry", "Chest X-ray"],
    recommendations: [
      "Vaping is not a safe alternative to smoking",
      "Stop all inhaled nicotine products",
      "Report respiratory symptoms immediately",
    ],
  },
  "Alcohol Use": {
    aliases: ["drinker", "alcohol consumption", "alcoholic", "inom", "tagay", "beer", "liquor"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 12,
    specialists: ["Gastroenterologist", "Psychiatrist", "Internal Medicine"],
    labTests: ["Liver Function Test", "CBC", "Gamma-GT", "Lipid Profile"],
    recommendations: [
      "Limit to ≤2 drinks/day (men), ≤1 drink/day (women)",
      "Eliminate alcohol if liver disease or high risk",
      "Seek support if unable to reduce",
    ],
  },
  "Substance Abuse": {
    aliases: ["drug abuse", "addiction", "illegal drugs", "shabu", "marijuana", "cocaine"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 25,
    specialists: ["Psychiatrist", "Addiction Specialist"],
    labTests: ["Drug Screen", "Hepatitis B/C Screening", "HIV Test"],
    recommendations: [
      "Referral to addiction medicine/substance abuse program",
      "Harm reduction and needle exchange if applicable",
      "Mental health co-occurring disorder treatment",
    ],
  },
  "Sedentary Lifestyle": {
    aliases: ["inactive", "no exercise", "couch potato", "office worker no activity", "puro upo"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 10,
    specialists: ["Internal Medicine", "Sports Medicine"],
    labTests: ["Lipid Profile", "Fasting Blood Glucose", "Blood Pressure Monitoring"],
    recommendations: [
      "Break up sitting every 30–60 minutes",
      "Start with walking 15–20 min/day, build to 150 min/week",
      "Include resistance training 2x/week",
    ],
  },
  "Poor Diet": {
    aliases: ["unhealthy diet", "junk food", "matabang pagkain", "processed food", "fast food", "ulam instant"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 10,
    specialists: ["Dietitian", "Internal Medicine"],
    labTests: ["Lipid Profile", "Fasting Blood Glucose", "Liver Function Test"],
    recommendations: [
      "Increase vegetables, fruits, whole grains, lean protein",
      "Eliminate sugary beverages and reduce processed foods",
      "Consult a registered dietitian",
    ],
  },
  "High Sodium Diet": {
    aliases: ["mahilig sa alat", "maraming asin", "salty food", "canned food", "instant noodles", "madaming salt"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 12,
    specialists: ["Cardiologist", "Nephrologist", "Dietitian"],
    labTests: ["Blood Pressure Monitoring", "Kidney Function Test", "Electrolytes"],
    recommendations: [
      "Limit sodium to <2,300mg/day (ideally <1,500mg if hypertension)",
      "Avoid canned, processed, and fast foods",
      "Use herbs and spices instead of salt",
    ],
  },
  "High Sugar Diet": {
    aliases: ["mahilig matamis", "maraming sugar", "soft drinks", "soda", "energy drinks", "sugary snacks"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 10,
    specialists: ["Endocrinologist", "Dietitian"],
    labTests: ["Fasting Blood Glucose", "HbA1c", "Lipid Profile", "Liver Function Test"],
    recommendations: [
      "Eliminate sugary beverages entirely",
      "Read labels for hidden sugars",
      "Replace sweets with whole fruits",
    ],
  },
  "Lack of Exercise": {
    aliases: ["no physical activity", "tamad mag exercise", "hirap mag exercise", "no workout"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 8,
    specialists: ["Sports Medicine", "Internal Medicine"],
    labTests: ["Lipid Profile", "Fasting Blood Glucose", "Blood Pressure Monitoring"],
    recommendations: [
      "Start with low-impact activity (walking, swimming)",
      "Gradual progression to 150 min/week moderate intensity",
    ],
  },
  "Sleep Deprivation": {
    aliases: ["kulang sa tulog", "puyat", "insufficient sleep", "sleep less than 6 hours"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 6,
    specialists: ["Sleep Specialist", "Psychiatrist"],
    labTests: ["Polysomnography (if indicated)", "Thyroid Function Test"],
    recommendations: [
      "Sleep 7–9 hours nightly",
      "Consistent sleep-wake schedule",
      "No screens 1 hour before bed",
    ],
  },
  "Chronic Stress": {
    aliases: ["sobrang stress", "burnout", "overworked", "chronic anxiety work", "emotional stress"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 7,
    specialists: ["Psychiatrist", "Psychologist"],
    labTests: ["Cortisol (optional)", "Thyroid Function Test", "Blood Pressure Monitoring"],
    recommendations: [
      "Stress management: meditation, breathing exercises, yoga",
      "Set work-life boundaries",
      "Counseling if persistent or affecting function",
    ],
  },
  "Excessive Caffeine Intake": {
    aliases: ["maraming kape", "coffee addict", "energy drink abuse", "too much caffeine"],
    category: CLINICAL_CATEGORIES.LIFESTYLE,
    weight: 4,
    specialists: ["Cardiologist", "Internal Medicine"],
    labTests: ["ECG", "Thyroid Function Test"],
    recommendations: [
      "Limit caffeine to <400mg/day (≈4 cups brewed coffee)",
      "Avoid energy drinks entirely",
      "Switch to decaf after noon",
    ],
  },

  // ── FAMILY HISTORY ──
  "Family History of Stroke": {
    aliases: ["stroke sa pamilya", "namana stroke", "parents had stroke", "siblings stroke"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 12,
    specialists: ["Neurologist", "Cardiologist"],
    labTests: ["Lipid Profile", "Blood Pressure Monitoring", "ECG"],
    recommendations: [
      "Aggressive cardiovascular risk factor modification",
      "Regular BP, lipid, and glucose monitoring",
      "Antiplatelet therapy may be indicated if high risk",
    ],
  },
  "Family History of Diabetes": {
    aliases: ["diabetes sa pamilya", "namana sugar", "parents diabetic", "siblings diabetic"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 10,
    specialists: ["Endocrinologist", "Internal Medicine"],
    labTests: ["Fasting Blood Glucose", "HbA1c", "Oral Glucose Tolerance Test"],
    recommendations: [
      "Annual glucose screening",
      "Weight management and physical activity",
      "Diet low in refined carbohydrates",
    ],
  },
  "Family History of Hypertension": {
    aliases: ["high blood sa pamilya", "namana highblood", "parents hypertensive"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 10,
    specialists: ["Cardiologist", "Internal Medicine"],
    labTests: ["Blood Pressure Monitoring", "Kidney Function Test", "ECG"],
    recommendations: [
      "Limit sodium intake",
      "Regular BP monitoring from early adulthood",
      "Maintain healthy weight",
    ],
  },
  "Family History of Cancer": {
    aliases: ["cancer sa pamilya", "namana cancer", "parents cancer", "siblings cancer", "genetic cancer risk"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 15,
    specialists: ["Oncologist", "Genetic Counselor"],
    labTests: ["Genetic Testing (BRCA, Lynch, etc.)", "Cancer Screening per guidelines"],
    recommendations: [
      "Genetic counseling and testing if indicated",
      "Enhanced surveillance (earlier/more frequent screening)",
      "Lifestyle risk reduction",
    ],
  },
  "Family History of Heart Disease": {
    aliases: ["sakit sa puso sa pamilya", "namana heart disease", "parents heart attack"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 12,
    specialists: ["Cardiologist"],
    labTests: ["Lipid Profile", "ECG", "Blood Pressure Monitoring"],
    recommendations: [
      "Aggressive LDL lowering",
      "Smoking cessation if applicable",
      "Regular cardiology check-ups",
    ],
  },
  "Family History of Kidney Disease": {
    aliases: ["sakit sa bato sa pamilya", "namana kidney", "parents kidney failure", "siblings ckd"],
    category: CLINICAL_CATEGORIES.FAMILY_HISTORY,
    weight: 10,
    specialists: ["Nephrologist"],
    labTests: ["Serum Creatinine", "eGFR", "Urinalysis", "Blood Pressure Monitoring"],
    recommendations: [
      "Annual kidney function screening",
      "Avoid nephrotoxic drugs",
      "Blood pressure control",
    ],
  },
};

/**
 * Build a fast lookup map: alias (lowercase) -> canonical label
 */
const ALIAS_MAP = new Map();
Object.entries(CLINICAL_TAG_REGISTRY).forEach(([canonical, data]) => {
  ALIAS_MAP.set(canonical.toLowerCase(), canonical);
  (data.aliases || []).forEach((alias) => {
    ALIAS_MAP.set(alias.toLowerCase(), canonical);
  });
});

/**
 * Build category -> canonical labels map
 */
const CATEGORY_MAP = {};
Object.entries(CLINICAL_TAG_REGISTRY).forEach(([canonical, data]) => {
  const cat = data.category;
  if (!CATEGORY_MAP[cat]) CATEGORY_MAP[cat] = [];
  CATEGORY_MAP[cat].push(canonical);
});

module.exports = {
  CLINICAL_CATEGORIES,
  CLINICAL_TAG_REGISTRY,
  REJECTED_TERMS,
  ALIAS_MAP,
  CATEGORY_MAP,
};
