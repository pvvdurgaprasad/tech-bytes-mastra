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

const approvalRecordSchema = z.object({
  required: z.boolean(),

  decision: z.enum([
    "not-required",
    "approved",
    "rejected",
  ]),

  reviewer: z.string().nullable(),

  comment: z.string().nullable(),

  decidedAt: z.string().nullable(),
});

const workItemSchema = z.object({
  workItemId: z.string(),

  title: z.string(),

  description: z.string(),

  affectedService: z.string(),

  priority: z.enum([
    "low",
    "medium",
    "high",
  ]),

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

  approval: approvalRecordSchema,

  status: z.enum([
    "ready-for-processing",
    "approved",
    "rejected",
  ]),

  createdAt: z.string(),
});

const reviewRequestSchema = z.object({
  title: z.string(),

  affectedService: z.string(),

  priority: z.enum([
    "low",
    "medium",
    "high",
  ]),

  impactSummary: z.string(),

  classificationReason: z.string(),

  serviceTier: z.enum([
    "critical",
    "important",
    "standard",
  ]),

  serviceOwner: z.string(),

  recommendedNextAction: z.string(),
});

const reviewDecisionSchema = z.object({
  decision: z.enum([
    "approved",
    "rejected",
  ]),

  reviewer: z.string().min(1),

  comment: z.string().min(1),
});

const reviewedRequestSchema =
  agentClassifiedRequestSchema.extend({
    approval: approvalRecordSchema,
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

export const humanApprovalGate = createStep({
  id: "human-approval-gate",

  inputSchema: agentClassifiedRequestSchema,

  outputSchema: reviewedRequestSchema,

  suspendSchema: reviewRequestSchema,

  resumeSchema: reviewDecisionSchema,

  execute: async ({
    inputData,
    resumeData,
    suspend,
  }) => {
    const { assessment } = inputData;

    if (!assessment.requiresHumanReview) {
      return {
        ...inputData,

        approval: {
          required: false,
          decision: "not-required" as const,
          reviewer: null,
          comment: null,
          decidedAt: null,
        },
      };
    }

    if (!resumeData) {
      return await suspend({
        title: inputData.title,

        affectedService:
          assessment.affectedService,

        priority:
          assessment.priority,

        impactSummary:
          assessment.impactSummary,

        classificationReason:
          assessment.classificationReason,

        serviceTier:
          assessment.serviceTier,

        serviceOwner:
          assessment.serviceOwner,

        recommendedNextAction:
          assessment.recommendedNextAction,
      });
    }

    return {
      ...inputData,

      approval: {
        required: true,
        decision: resumeData.decision,
        reviewer: resumeData.reviewer,
        comment: resumeData.comment,
        decidedAt: new Date().toISOString(),
      },
    };
  },
});

const createWorkItem = createStep({
  id: "create-work-item",

  inputSchema: reviewedRequestSchema,

  outputSchema: workItemSchema,

  execute: async ({ inputData }) => {
    const { assessment, approval } = inputData;

    const finalStatus =
      approval.decision === "rejected"
        ? "rejected"
        : approval.decision === "approved"
          ? "approved"
          : "ready-for-processing";

    return {
      workItemId: crypto.randomUUID(),

      title: inputData.title,

      description: inputData.description,

      affectedService:
        assessment.affectedService,

      priority:
        assessment.priority,

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

      approval,

      status: finalStatus,

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
  .then(humanApprovalGate)
  .then(createWorkItem)
  .commit();