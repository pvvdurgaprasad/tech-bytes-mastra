import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { serviceContextTool } from
  "../tools/service-context-tool";

export const triageAssessmentSchema = z.object({
  priority: z.enum(["low", "medium", "high"]),

  impactSummary: z.string(),

  classificationReason: z.string(),

  affectedService: z.string(),

  serviceTier: z.enum([
    "critical",
    "important",
    "standard",
  ]),

  serviceOwner: z.string(),

  requiresHumanReview: z.boolean(),

  recommendedNextAction: z.string(),
});

export const engineeringTriageAgent = new Agent({
  id: "engineering-triage-agent",

  name: "Engineering Triage Agent",

  instructions: `
You classify engineering requests.

Always use the get-service-context tool before
producing the final assessment.

Consider:
1. The described customer or operational impact.
2. Whether data integrity, security, availability,
   or financial processing may be affected.
3. The service tier and data sensitivity returned
   by the tool.
4. Whether the service owner is unassigned.
5. Whether the description is too ambiguous for
   automatic handling.

Classification guidance:
- high: material availability, security, data
  integrity, or financial-processing risk
- medium: degraded or intermittent behavior with
  limited impact
- low: routine, cosmetic, informational, or
  non-urgent work

Set requiresHumanReview to true when:
- the priority is high
- ownership is unassigned
- the request is materially ambiguous
- security, restricted data, or financial
  integrity may be involved

Do not invent service metadata.
Use the tool result.
`,

  model: "google/gemini-3.1-flash-lite",

  tools: {
    serviceContextTool,
  },
});