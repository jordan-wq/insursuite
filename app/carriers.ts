export type CarrierEntry = { logo?: string; url?: string };

export const CARRIER_DIRECTORY: Record<string, CarrierEntry> = {
  "northwestern mutual": { url: "https://www.northwesternmutual.com" },
  "banner life": { url: "https://www.bannerlife.com" },
  "haven life": { url: "https://www.havenlife.com" },
  "rbc insurance": { url: "https://www.rbcinsurance.com" },
  "mutual of omaha": { url: "https://www.mutualofomaha.com" },
};

export function lookupCarrier(name: string | undefined): CarrierEntry | null {
  if (!name) return null;
  return CARRIER_DIRECTORY[name.trim().toLowerCase()] ?? null;
}
