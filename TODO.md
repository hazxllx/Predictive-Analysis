# Dashboard API/Error Handling Refactor TODO

- [x] Replace `/risk-assessment/user` usage with PMS health-record endpoints in PatientDashboard
- [x] Replace `/risk-assessment/user` usage with PMS health-record endpoints in MyProgress
- [x] Treat 404 as no-data (non-error) for assessment loading logic
- [x] Enforce strict render order: loading -> error -> not connected -> connected/no data -> full data
- [x] Ensure connection source of truth remains `/patients/me` only
- [x] Prevent blank render and duplicate/overlapping states
- [ ] Run verification checks
