export const normalizePatients = (res) => {
  if (!res) return [];

  const data = res.data;

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.data?.patients)) {
    return data.data.patients;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
};
