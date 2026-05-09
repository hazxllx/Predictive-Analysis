const User = require("../models/User");
const { fetchAllPatients } = require("./pmsService");

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
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

function getPatientDisplayName(patient = {}) {
  const directName = String(patient?.name || "").trim();
  if (directName) return directName;

  return [patient?.first_name, patient?.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
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

function serializeLinkOptions(matches = []) {
  return matches.map((match) => ({
    patient_id: match?.patient_id || null,
    name: getPatientDisplayName(match) || null,
  }));
}

function baseResult(user, overrides = {}) {
  return {
    linked: false,
    autoLinked: false,
    multipleMatches: false,
    noMatch: false,
    duplicateLink: false,
    staleLink: false,
    conflictingData: false,
    options: [],
    data: null,
    linkedPatientId: null,
    matchedBy: null,
    user,
    ...overrides,
  };
}

async function ensurePatientIdAvailable(user, patientId) {
  const normalizedPatientId = normalizeIdentifier(patientId);
  if (!normalizedPatientId || !user?._id) return true;

  const owner = await User.findOne({
    _id: { $ne: user._id },
    role: "patient",
    patient_id: new RegExp(`^${escapeRegExp(String(patientId).trim())}$`, "i"),
  })
    .select("_id")
    .lean();

  return !owner;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function persistUserPatientId(user, nextPatientId, matchedBy) {
  const normalizedCurrent = normalizeIdentifier(user?.patient_id);
  const normalizedNext = normalizeIdentifier(nextPatientId);

  if (!user?._id || !normalizedNext) return user;

  const update = {
    patient_id: nextPatientId,
    pms_linked_at: new Date(),
    pms_matched_by: matchedBy,
  };

  if (normalizedCurrent === normalizedNext) {
    const updatedUser = await User.findByIdAndUpdate(user._id, update, { new: true }).select("-password");
    return updatedUser || user;
  }

  const updatedUser = await User.findByIdAndUpdate(user._id, update, { new: true }).select("-password");
  return updatedUser || user;
}

async function linkedResult({ user, patient, matchedBy, autoLinked, persist, hydrate }) {
  const patientId = patient?.patient_id;
  const available = await ensurePatientIdAvailable(user, patientId);

  if (!available) {
    return baseResult(user, {
      duplicateLink: true,
      linkedPatientId: patientId || null,
    });
  }

  const syncedUser = persist === false ? user : await persistUserPatientId(user, patientId, matchedBy);
  const data = hydrate === false ? null : patient;

  return baseResult(syncedUser, {
    linked: true,
    autoLinked,
    data,
    linkedPatientId: patientId,
    matchedBy,
  });
}

async function resolvePatientLink(user, options = {}) {
  const userRole = options?.role || user?.role;
  const hydrate = options?.hydrate !== false;

  const normalizedUserName = normalizeName(options?.name || user?.name);
  const nameToMatch = normalizedUserName;

  if (userRole !== "patient") {
    return baseResult(user);
  }

  // Strict PMS matching: full name first, patient ID only as a duplicate-name tie breaker.
  if (!nameToMatch) {
    return baseResult(user, {
      noMatch: true,
      staleLink: Boolean(user?.patient_id),
      linkedPatientId: user?.patient_id || null,
    });
  }

  let patients = [];
  try {
    patients = Array.isArray(options?.patients)
      ? options.patients
      : await fetchAllPatients({ force: options?.force });
  } catch (error) {
    return baseResult(user, {
      noMatch: true,
      staleLink: Boolean(user?.patient_id),
      linkedPatientId: user?.patient_id || null,
    });
  }

  const nameMatches = patients
    .map((patient) => ({
      patient,
      normalizedName: normalizeName(getPatientDisplayName(patient)),
    }))
    .filter((x) => x.normalizedName === nameToMatch)
    .map((x) => x.patient);

  const explicitIds = getUserIdentifiers({}, options?.identifiers);
  const userIdentifiers = getUserIdentifiers(user, options?.identifiers);

  // Name is the source of truth. A single normalized full-name match can link safely.
  if (nameMatches.length === 1) {
    const linkedPatient = nameMatches[0];

    if (
      explicitIds.length > 0 &&
      !getPatientIdentifiers(linkedPatient).some((identifier) => explicitIds.includes(identifier))
    ) {
      return baseResult(user, {
        conflictingData: true,
        linkedPatientId: linkedPatient.patient_id || null,
      });
    }

    const result = await linkedResult({
      user,
      patient: linkedPatient,
      matchedBy: "name",
      autoLinked: true,
      persist: options?.persist,
      hydrate,
    });

    return result;
  }

  // Duplicate PMS names are the only case where an ID is allowed to disambiguate.
  if (nameMatches.length > 1) {
    const savedId = normalizeIdentifier(user?.patient_id);

    let identifierMatch = null;
    if (savedId) {
      identifierMatch =
        nameMatches.find((p) => normalizeIdentifier(p?.patient_id) === savedId) || null;
    }

    // Otherwise try matching any user identifier present in PMS patient identifiers
    if (!identifierMatch && userIdentifiers.length > 0) {
      identifierMatch =
        nameMatches.find((p) =>
          getPatientIdentifiers(p).some((identifier) => userIdentifiers.includes(identifier))
        ) || null;
    }

    if (identifierMatch) {
      const result = await linkedResult({
        user,
        patient: identifierMatch,
        matchedBy: "patient_id",
        autoLinked: true,
        persist: options?.persist,
        hydrate,
      });

      return result;
    }

    return baseResult(user, {
      multipleMatches: true,
      options: serializeLinkOptions(nameMatches),
    });
  }

  return baseResult(user, {
    noMatch: true,
    staleLink: Boolean(user?.patient_id),
    linkedPatientId: user?.patient_id || null,
  });
}

module.exports = {
  normalizeName,
  normalizeIdentifier,
  resolvePatientLink,
};
