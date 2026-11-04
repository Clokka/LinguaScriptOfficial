import assert from "node:assert/strict";
import { schoolEnquirySchema } from "../src/lib/schoolEnquiry";
const valid = { school: "Example College", name: "Teacher Example", email: "teacher@example.com", students: 30, needs: "French vocabulary practice" };
assert.equal(schoolEnquirySchema.safeParse(valid).success, true);
assert.equal(schoolEnquirySchema.safeParse({ ...valid, email: "not-an-email" }).success, false);
assert.equal(schoolEnquirySchema.safeParse({ ...valid, needs: "" }).success, false);
assert.equal(schoolEnquirySchema.safeParse({ ...valid, students: -1 }).success, false);
console.log("School enquiry validation passed");