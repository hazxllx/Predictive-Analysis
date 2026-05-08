# Dashboard API/Error Handling Refactor TODO

- [x] Replace `/risk-assessment/user` usage with PMS health-record endpoints in PatientDashboard
- [x] Replace `/risk-assessment/user` usage with PMS health-record endpoints in MyProgress
- [x] Treat 404 as no-data (non-error) for assessment loading logic
- [x] Enforce strict render order: loading -> error -> not connected -> connected/no data -> full data
- [x] Ensure connection source of truth remains `/patients/me` only
- [x] Prevent blank render and duplicate/overlapping states
- [ ] Run verification checks

## Current Task: Patient Card + Patient Detail Stabilization

- [ ] Harden PMS normalization (`frontend/src/utils/normalizePatients.js`)
- [ ] Fix Patient Detail assessment parsing/state (`frontend/src/pages/PatientDetail.jsx`)
- [ ] Fix Patient Card rendering safety (`frontend/src/components/PatientCard.jsx`)
- [ ] Fix Patients registry condition hydration (`frontend/src/pages/Patients.jsx`)
- [ ] Run frontend verification build
