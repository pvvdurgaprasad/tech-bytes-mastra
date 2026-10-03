import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { triageAssessmentSchema } from
  "../agents/engineering-triage-agent";

const requestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  affectedService: z.string().min(1),
});

const normalizedRequestSchema = z.object({
  title: z.string(),
  description: z.string(),
  affectedService: z.string(),
  receivedAt: z.string(),
});

const agentClassifiedRequestSchema =
  normalizedRequestSchema.extend({
    assessment: triageAssessmentSchema,
  });


const workItemSchema = z.object({
  workItemId: z.string(),
  title: z.string(),
  description: z.string(),
  affectedService: z.string(),

  priority: z.enum(["low", "medium", "high"]),

  impactSummary: z.string(),

  classificationReason: z.string(),

  serviceTier: z.enum([
    "critical",
    "important",
    "standard",
  ]),

  serviceOwner: z.string(),

  requiresHumanReview: z.boolean(),

  recommendedNextAction: z.string(),

  status: z.enum([
    "ready-for-processing",
    "review-required",
  ]),

  createdAt: z.string(),
});

const normalizeRequest = createStep({
  id: "normalize-request",
  inputSchema: requestSchema,
  outputSchema: normalizedRequestSchema,

  execute: async ({ inputData }) => {
    return {
      title: inputData.title.trim(),
      description: inputData.description.trim(),
      affectedService: inputData.affectedService
        .trim()
        .toLowerCase(),
      receivedAt: new Date().toISOString(),
    };
  },
});

const classifyWithAgent = createStep({
  id: "classify-with-agent",

  inputSchema: normalizedRequestSchema,

  outputSchema: agentClassifiedRequestSchema,

  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(
      "engineeringTriageAgent"
    );

    const response = await agent.generate(
      `
Classify this engineering request.

Title:
${inputData.title}

Description:
${inputData.description}

Affected service:
${inputData.affectedService}
      `,
      {
        structuredOutput: {
          schema: triageAssessmentSchema,
        },
      }
    );

    return {
      ...inputData,
      assessment: response.object,
    };
  },
});

const applyTriagePolicy = createStep({
  id: "apply-triage-policy",

  inputSchema: agentClassifiedRequestSchema,

  outputSchema: agentClassifiedRequestSchema,

  execute: async ({ inputData }) => {
    const assessment = inputData.assessment;

    const ownershipMissing =
      assessment.serviceOwner === "unassigned";

    const highRisk =
      assessment.priority === "high";

    const restrictedService =
      assessment.serviceTier === "critical";

    return {
      ...inputData,

      assessment: {
        ...assessment,

        requiresHumanReview:
          assessment.requiresHumanReview ||
          ownershipMissing ||
          highRisk ||
          restrictedService,
      },
    };
  },
});

const createWorkItem = createStep({
  id: "create-work-item",

  inputSchema: agentClassifiedRequestSchema,

  outputSchema: workItemSchema,

  execute: async ({ inputData }) => {
    const { assessment } = inputData;

    return {
      workItemId: crypto.randomUUID(),

      title: inputData.title,

      description: inputData.description,

      affectedService:
        assessment.affectedService,

      priority: assessment.priority,

      impactSummary:
        assessment.impactSummary,

      classificationReason:
        assessment.classificationReason,

      serviceTier:
        assessment.serviceTier,

      serviceOwner:
        assessment.serviceOwner,

      requiresHumanReview:
        assessment.requiresHumanReview,

      recommendedNextAction:
        assessment.recommendedNextAction,

      status: assessment.requiresHumanReview
        ? "review-required" as const
        : "ready-for-processing" as const,

      createdAt: new Date().toISOString(),
    };
  },
});

export const engineeringRequestWorkflow = createWorkflow({
  id: "engineering-request-workflow",
  inputSchema: requestSchema,
  outputSchema: workItemSchema,
})
  .then(normalizeRequest)
  .then(classifyWithAgent)
  .then(applyTriagePolicy)
  .then(createWorkItem)
  .commit();