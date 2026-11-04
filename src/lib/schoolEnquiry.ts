import { z } from "zod";

export const schoolEnquirySchema = z.object({
  school: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  students: z.number().int().min(1).max(100000).nullable(),
  needs: z.string().trim().min(5).max(2000),
});