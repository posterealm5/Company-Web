export const COD_ENABLED = true;

export interface CodLocation {
  city: string;
  state: string;
}

export const COD_ELIGIBLE_LOCATIONS: CodLocation[] = [
  {
    city: "Udaipur",
    state: "Rajasthan"
  }
];

/**
 * Checks if the given address string is eligible for Cash on Delivery (COD).
 * Case-insensitive and ignores leading/trailing whitespace.
 */
export function checkCodEligibility(address: string | null | undefined): boolean {
  if (!COD_ENABLED || !address) return false;

  const normalizedAddress = address.toLowerCase();

  return COD_ELIGIBLE_LOCATIONS.some(loc => {
    const city = loc.city.trim().toLowerCase();
    const state = loc.state.trim().toLowerCase();

    return normalizedAddress.includes(city) && normalizedAddress.includes(state);
  });
}
