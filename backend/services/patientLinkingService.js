const User = require("../models/User");
const { fetchAllPatients } = require("./pmsService");

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getPatientIdentifiers(patient = {}) {
  return uniqueValues(
    [
      patient?.patient_id,
      patient?.patientId,
      patient?.external_id,
      patient?.externalId,
      patient?.registry_id,
      patient?.registryId,
      patient?.id,
    ].map(normalizeIdentifier)
  );
}

function getUserIdentifiers(user = {}, overrides = {}) {
  return uniqueValues(
    [
      overrides?.patient_id,
      overrides?.patientId,
      overrides?.external_id,
      overrides?.externalId,
      overrides?.registry_id,
      overrides?.registryId,
      user?.patient_id,
      user?.patientId,
      user?.external_id,
      user?.externalId,
      user?.registry_id,
      user?.registryId,
    ].map(normalizeIdentifier)
  );
}

function getPatientDisplayName(patient = {}) {
  const directName = String(patient?.name || "").trim();
  if (directName) return directName;

  const combinedName = [patient?.first_name, patient?.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  return combinedName;
}

function serializeLinkOptions(matches = []) {
  return matches.map((match) => ({
    patient_id: match?.patient_id || null,
    name: getPatientDisplayName(match) || null,
  }));
}

async function persistUserPatientId(user, nextPatientId) {
  const normalizedCurrent = normalizeIdentifier(user?.patient_id);
  const normalizedNext = normalizeIdentifier(nextPatientId);

  if (!user?._id || !normalizedNext || normalizedCurrent === normalizedNext) {
    return user;
  }

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { patient_id: nextPatientId },
    { new: true }
  ).select("-password");

  return updatedUser || user;
}

async function resolvePatientLink(user, options = {}) {
  const userRole = options?.role || user?.role;
  const nameToMatch = normalizeName(options?.name || user?.name);

  if (userRole !== "patient") {
    return {
      linked: false,
      autoLinked: false,
      multipleMatches: false,
      noMatch: false,
      options: [],
      data: null,
      linkedPatientId: null,
      matchedBy: null,
      user,
    };
  }

  const patients = Array.isArray(options?.patients) ? options.patients : await fetchAllPatients();
  const userIdentifiers = getUserIdentifiers(user, options?.identifiers);
  const explicitPatientId = normalizeIdentifier(user?.patient_id);

  if (explicitPatientId) {
    const linkedPatient = patients.find((patient) => getPatientIdentifiers(patient).includes(explicitPatientId));

    if (linkedPatient) {
      return {
        linked: true,
        autoLinked: false,
        multipleMatches: false,
        noMatch: false,
        options: [],
        data: linkedPatient,
        linkedPatientId: linkedPatient.patient_id,
        matchedBy: "patient_id",
        user,
      };
    }

    return {
      linked: false,
      autoLinked: false,
      multipleMatches: false,
      noMatch: true,
      staleLink: true,
      options: [],
      data: null,
      linkedPatientId: user.patient_id,
      matchedBy: null,
      user,
    };
  }

  if (!nameToMatch) {
    return {
      linked: false,
      autoLinked: false,
      multipleMatches: false,
      noMatch: true,
      options: [],
      data: null,
      linkedPatientId: null,
      matchedBy: null,
      user,
    };
  }

  const nameMatches = patients.filter((patient) => normalizeName(getPatientDisplayName(patient)) === nameToMatch);

  if (nameMatches.length === 1) {
    const linkedPatient = nameMatches[0];
    const syncedUser = options?.persist === false ? user : await persistUserPatientId(user, linkedPatient.patient_id);

    return {
      linked: true,
      autoLinked: true,
      multipleMatches: false,
      noMatch: false,
      options: [],
      data: linkedPatient,
      linkedPatientId: linkedPatient.patient_id,
      matchedBy: "name",
      user: syncedUser,
    };
  }

  if (nameMatches.length > 1) {
    const identifierMatch = nameMatches.find((patient) =>
      getPatientIdentifiers(patient).some((identifier) => userIdentifiers.includes(identifier))
    );

    if (identifierMatch) {
      const syncedUser =
        options?.persist === false ? user : await persistUserPatientId(user, identifierMatch.patient_id);

      return {
        linked: true,
        autoLinked: true,
        multipleMatches: false,
        noMatch: false,
        options: [],
        data: identifierMatch,
        linkedPatientId: identifierMatch.patient_id,
        matchedBy: "patient_id",
        user: syncedUser,
      };
    }

    return {
      linked: false,
      autoLinked: false,
      multipleMatches: true,
      noMatch: false,
      options: serializeLinkOptions(nameMatches),
      data: null,
      linkedPatientId: null,
      matchedBy: null,
      user,
    };
  }

  return {
    linked: false,
    autoLinked: false,
    multipleMatches: false,
    noMatch: true,
    options: [],
    data: null,
    linkedPatientId: null,
    matchedBy: null,
    user,
  };
}

module.exports = {
  normalizeName,
  normalizeIdentifier,
  resolvePatientLink,
};
