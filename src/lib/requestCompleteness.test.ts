import { describe, it, expect } from "vitest";
import { missingCampaignFields, isRequestComplete } from "./requestCompleteness";

const COMPLETE = {
  campaign_name: "Q3 IT Phishing Test",
  email_subject: "Your account needs attention",
  email_html_body: "<p>Click here</p>",
  group_ids: ["g-1"],
  target_departments: [],
};

describe("missingCampaignFields", () => {
  it("returns empty array for a fully-populated request with groups", () => {
    expect(missingCampaignFields(COMPLETE)).toEqual([]);
  });

  it("returns empty array when target_departments provides coverage instead of groups", () => {
    expect(
      missingCampaignFields({ ...COMPLETE, group_ids: [], target_departments: ["d-1"] })
    ).toEqual([]);
  });

  it("returns empty array when both groups and departments are present", () => {
    expect(
      missingCampaignFields({ ...COMPLETE, group_ids: ["g-1"], target_departments: ["d-1"] })
    ).toEqual([]);
  });

  it("flags missing campaign_name", () => {
    expect(missingCampaignFields({ ...COMPLETE, campaign_name: "" })).toContain("campaign name");
    expect(missingCampaignFields({ ...COMPLETE, campaign_name: "   " })).toContain("campaign name");
    expect(missingCampaignFields({ ...COMPLETE, campaign_name: null })).toContain("campaign name");
  });

  it("flags missing email_subject", () => {
    expect(missingCampaignFields({ ...COMPLETE, email_subject: "" })).toContain("email subject");
    expect(missingCampaignFields({ ...COMPLETE, email_subject: undefined })).toContain("email subject");
  });

  it("flags missing email_html_body", () => {
    expect(missingCampaignFields({ ...COMPLETE, email_html_body: "" })).toContain("email HTML body");
    expect(missingCampaignFields({ ...COMPLETE, email_html_body: null })).toContain("email HTML body");
  });

  it("flags missing targets when both groups and departments are empty", () => {
    expect(
      missingCampaignFields({ ...COMPLETE, group_ids: [], target_departments: [] })
    ).toContain("target group or department");
  });

  it("flags missing targets when both fields are null/undefined", () => {
    expect(
      missingCampaignFields({ ...COMPLETE, group_ids: null, target_departments: null })
    ).toContain("target group or department");
    expect(
      missingCampaignFields({ ...COMPLETE, group_ids: undefined, target_departments: undefined })
    ).toContain("target group or department");
  });

  it("can report multiple missing fields at once", () => {
    const result = missingCampaignFields({
      campaign_name: "",
      email_subject: "",
      email_html_body: "",
      group_ids: [],
      target_departments: [],
    });
    expect(result).toHaveLength(4);
    expect(result).toContain("campaign name");
    expect(result).toContain("email subject");
    expect(result).toContain("email HTML body");
    expect(result).toContain("target group or department");
  });

  it("treats an empty object as missing all required fields", () => {
    expect(missingCampaignFields({})).toHaveLength(4);
  });
});

describe("isRequestComplete", () => {
  it("returns true for a complete request", () => {
    expect(isRequestComplete(COMPLETE)).toBe(true);
  });

  it("returns false when any required field is absent", () => {
    expect(isRequestComplete({ ...COMPLETE, campaign_name: "" })).toBe(false);
    expect(isRequestComplete({ ...COMPLETE, email_subject: null })).toBe(false);
    expect(isRequestComplete({ ...COMPLETE, email_html_body: "" })).toBe(false);
    expect(isRequestComplete({ ...COMPLETE, group_ids: [], target_departments: [] })).toBe(false);
  });
});
