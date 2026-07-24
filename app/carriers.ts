export type CarrierEntry = { logo?: string; url?: string };

export const CARRIER_DIRECTORY: Record<string, CarrierEntry> = {
  "northwestern mutual": { url: "https://www.northwesternmutual.com" },
  "banner life": { logo: "/carriers/banner-life.svg", url: "https://www.bannerlife.com" },
  "haven life": { url: "https://www.havenlife.com" },
  "rbc insurance": { logo: "/carriers/rbc-insurance.svg", url: "https://www.rbcinsurance.com" },
  "mutual of omaha": { logo: "/carriers/mutual-of-omaha.png", url: "https://www.mutualofomaha.com" },
};

export function lookupCarrier(name: string | undefined): CarrierEntry | null {
  if (!name) return null;
  return CARRIER_DIRECTORY[name.trim().toLowerCase()] ?? null;
}
