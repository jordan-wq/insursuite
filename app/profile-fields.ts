export type ProfileValue = string | boolean;

export const CORE_PROFILE_FIELDS = [
  "preferredName",
  "dateOfBirth",
  "address",
  "city",
  "state",
  "postalCode",
  "preferredContact",
  "bestContactTime",
  "maritalStatus",
  "spouseName",
  "dependentsCount",
  "dependentDetails",
  "householdNotes",
  "employmentStatus",
  "occupation",
  "annualIncomeRange",
  "householdIncomeRange",
  "mortgageBalance",
  "otherDebt",
  "liquidSavings",
  "monthlyCoverageBudget",
  "primaryGoal",
  "incomeReplacementYears",
  "desiredCoverage",
  "educationFunding",
  "finalExpenseGoal",
  "businessObligations",
  "coverageConcerns",
  "hasExistingCoverage",
  "policyCount",
  "employerCoverage",
  "knownCarriers",
  "currentCoverageEstimate",
  "currentPremiumEstimate",
  "policyConcerns",
  "uploadAfterOnboarding",
  "primaryBeneficiary",
  "primaryRelationship",
  "primaryPercentage",
  "contingentBeneficiary",
  "contingentRelationship",
  "trustOrEstate",
  "emergencyContactName",
  "emergencyContactPhone",
  "reviewFrequency",
  "communicationStyle",
  "availability",
  "meetingAvailability",
  "existingAdvisor",
  "lifeEvents",
  "majorLifeEvents",
  "informationConsent",
  "accuracyAttestation",
  "consentAccuracy",
  "consentCommunication",
] as const;

export const UNDERWRITING_PROFILE_FIELDS = [
  "underwritingStatus",
  "underwritingPriority",
  "underwritingCallNotes",
  "coverageNeed",
  "policyPurpose",
  "nicotineUse",
  "heightWeight",
  "healthNotes",
  "medications",
  "familyHealthHistory",
  "drivingHistory",
  "hazardousActivities",
  "advisorQuestions",
  "missingDocuments",
  "callOutcome",
] as const;

export const READINESS_PROFILE_FIELDS = [
  "primaryGoal",
  "annualIncomeRange",
  "dependentsCount",
  "primaryBeneficiary",
  "emergencyContactName",
  "reviewFrequency",
] as const;

export const CALL_INTAKE_REQUIRED_FIELDS = [
  "primaryGoal",
  "coverageNeed",
  "annualIncomeRange",
  "dependentsCount",
  "nicotineUse",
  "heightWeight",
  "healthNotes",
  "emergencyContactName",
  "missingDocuments",
  "callOutcome",
] as const;

export const ALLOWED_PROFILE_FIELDS = [...CORE_PROFILE_FIELDS, ...UNDERWRITING_PROFILE_FIELDS] as const;

export const allowedProfileFieldSet = new Set<string>(ALLOWED_PROFILE_FIELDS);

export function sanitizeProfile(input: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => allowedProfileFieldSet.has(key) && (typeof value === "string" || typeof value === "boolean"))
      .map(([key, value]) => [key, typeof value === "string" ? value.trim().slice(0, 1200) : value]),
  ) as Record<string, ProfileValue>;
}
