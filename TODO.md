# PMS Integration Final Debug TODO

- [ ] Standardize backend patient ID usage to `patient_id` only
- [ ] Fix backend `/patients/:id` response shape to `{ data: patient }`
- [ ] Ensure PMS patient fetch + health-record attachment by `patient_id`
- [ ] Fix frontend patient navigation to use `patient.patient_id` only
- [ ] Fix frontend patient detail parsing for `{ data: patient }`
- [ ] Add required temporary trace logs (frontend + backend)
- [ ] Remove temporary/dev comments and debug logs after validation
- [ ] Run validation checks and confirm end-to-end data flow
