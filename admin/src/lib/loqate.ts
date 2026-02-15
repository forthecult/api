/**
 * Map Loqate Retrieve response to shipping form fields.
 * Mirrors main app's mapRetrieveToShipping for use in admin (order/customer address forms).
 */
export interface LoqateRetrieveAddress {
  AdminAreaCode?: string;
  AdminAreaName?: string;
  BuildingName?: string;
  BuildingNumber?: string;
  City?: string;
  CountryIso2?: string;
  CountryIso3?: string;
  Line1?: string;
  Line2?: string;
  PostalCode?: string;
  ProvinceCode?: string;
  ProvinceName?: string;
  Street?: string;
  SubBuilding?: string;
}

export interface MappedShippingAddress {
  apartment: string;
  city: string;
  country: string;
  state: string;
  street: string;
  zip: string;
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
  return { apartment, city, country, state, street, zip };
}
