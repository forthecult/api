/**
 * Map Loqate Retrieve response to shipping form fields.
 * Mirrors main app's mapRetrieveToShipping for use in admin (order/customer address forms).
 */
export interface LoqateRetrieveAddress {
  Line1?: string;
  Line2?: string;
  Street?: string;
  City?: string;
  ProvinceCode?: string;
  AdminAreaCode?: string;
  ProvinceName?: string;
  AdminAreaName?: string;
  PostalCode?: string;
  CountryIso2?: string;
  CountryIso3?: string;
  SubBuilding?: string;
  BuildingNumber?: string;
  BuildingName?: string;
}

export interface MappedShippingAddress {
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export function mapRetrieveToShipping(
  addr: LoqateRetrieveAddress,
): MappedShippingAddress {
  const street =
    addr.Line1?.trim() ||
    [addr.BuildingNumber, addr.BuildingName, addr.Street]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "";
  const apartment = addr.Line2?.trim() || addr.SubBuilding?.trim() || "";
  const city = addr.City?.trim() || "";
  const state =
    addr.ProvinceCode?.trim() ||
    addr.AdminAreaCode?.trim() ||
    addr.ProvinceName?.trim() ||
    addr.AdminAreaName?.trim() ||
    "";
  const zip = addr.PostalCode?.trim() || "";
  const country = addr.CountryIso2?.trim() || addr.CountryIso3?.trim() || "";
  return { street, apartment, city, state, zip, country };
}
