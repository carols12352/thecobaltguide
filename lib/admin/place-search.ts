export type PlaceSearchCriteria = {
  placeId?: string;
  name?: string;
  postalCode?: string;
  addressLine1?: string;
};

export type PlaceSearchInputs = {
  name: string;
  postalCode: string;
  addressLine1: string;
};

export const PLACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PLACE_SEARCH_REQUIRED_MESSAGE =
  "Enter a merchant name, postal code, or address.";

export function parsePlaceSearchInput(inputs: PlaceSearchInputs): {
  criteria: PlaceSearchCriteria | null;
  error: string | null;
} {
  const name = inputs.name.trim();
  const postalCode = inputs.postalCode.trim();
  const addressLine1 = inputs.addressLine1.trim();

  if (!name && !postalCode && !addressLine1) {
    return { criteria: null, error: PLACE_SEARCH_REQUIRED_MESSAGE };
  }

  if (name && PLACE_ID_PATTERN.test(name) && !postalCode && !addressLine1) {
    return { criteria: { placeId: name }, error: null };
  }

  return {
    criteria: {
      name: name || undefined,
      postalCode: postalCode || undefined,
      addressLine1: addressLine1 || undefined,
    },
    error: null,
  };
}

export function buildAdminPlacesSearchParams(
  criteria: PlaceSearchCriteria,
  options: { page: number; limit: number; status?: string },
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
  });

  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  if (criteria.placeId) {
    params.set("placeId", criteria.placeId);
  }
  if (criteria.name) {
    params.set("name", criteria.name);
  }
  if (criteria.postalCode) {
    params.set("postalCode", criteria.postalCode);
  }
  if (criteria.addressLine1) {
    params.set("addressLine1", criteria.addressLine1);
  }

  return params;
}
