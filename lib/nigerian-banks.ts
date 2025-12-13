// List of Nigerian banks with their codes for Paystack
export interface NigerianBank {
  name: string;
  code: string;
  slug: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: "Access Bank", code: "044", slug: "access-bank" },
  { name: "Citibank", code: "023", slug: "citibank" },
  { name: "Diamond Bank", code: "063", slug: "diamond-bank" },
  { name: "Ecobank Nigeria", code: "050", slug: "ecobank-nigeria" },
  { name: "Fidelity Bank", code: "070", slug: "fidelity-bank" },
  { name: "First Bank of Nigeria", code: "011", slug: "first-bank-of-nigeria" },
  { name: "First City Monument Bank", code: "214", slug: "first-city-monument-bank" },
  { name: "Guaranty Trust Bank", code: "058", slug: "guaranty-trust-bank" },
  { name: "Heritage Bank", code: "030", slug: "heritage-bank" },
  { name: "Jaiz Bank", code: "301", slug: "jaiz-bank" },
  { name: "Keystone Bank", code: "082", slug: "keystone-bank" },
  { name: "Providus Bank", code: "101", slug: "providus-bank" },
  { name: "Polaris Bank", code: "076", slug: "polaris-bank" },
  { name: "Stanbic IBTC Bank", code: "221", slug: "stanbic-ibtc-bank" },
  { name: "Standard Chartered Bank", code: "068", slug: "standard-chartered-bank" },
  { name: "Sterling Bank", code: "232", slug: "sterling-bank" },
  { name: "Suntrust Bank", code: "100", slug: "suntrust-bank" },
  { name: "Union Bank of Nigeria", code: "032", slug: "union-bank-of-nigeria" },
  { name: "United Bank For Africa", code: "033", slug: "united-bank-for-africa" },
  { name: "Unity Bank", code: "215", slug: "unity-bank" },
  { name: "Wema Bank", code: "035", slug: "wema-bank" },
  { name: "Zenith Bank", code: "057", slug: "zenith-bank" },
];

export function getBankByCode(code: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => bank.code === code);
}

export function getBankByName(name: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => bank.name.toLowerCase() === name.toLowerCase());
}

