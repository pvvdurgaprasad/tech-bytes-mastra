import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

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

const classifiedRequestSchema = normalizedRequestSchema.extend({
  priority: z.enum(["low", "medium", "high"]),
  classificationReason: z.string(),
});

const workItemSchema = z.object({
  workItemId: z.string(),
  title: z.string(),
  description: z.string(),
  affectedService: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  classificationReason: z.string(),
  status: z.literal("ready-for-review"),
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

const classifyPriority = createStep({
  id: "classify-priority",
  inputSchema: normalizedRequestSchema,
  outputSchema: classifiedRequestSchema,

  execute: async ({ inputData }) => {
    const combinedText =
      `${inputData.title} ${inputData.description}`.toLowerCase();

    const highPrioritySignals = [
      "outage",
      "production down",
      "data loss",
      "security breach",
      "500 error",
    ];

    const mediumPrioritySignals = [
      "degraded",
      "intermittent",
      "timeout",
      "slow",
      "failed request",
    ];

    const matchedHighSignal = highPrioritySignals.find((signal) =>
      combinedText.includes(signal)
    );

    const matchedMediumSignal = mediumPrioritySignals.find((signal) =>
      combinedText.includes(signal)
    );

    if (matchedHighSignal) {
      return {
        ...inputData,
        priority: "high" as const,
        classificationReason:
          `Matched high-priority signal: ${matchedHighSignal}`,
      };
    }

    if (matchedMediumSignal) {
      return {
        ...inputData,
        priority: "medium" as const,
        classificationReason:
          `Matched medium-priority signal: ${matchedMediumSignal}`,
      };
    }

    return {
      ...inputData,
      priority: "low" as const,
      classificationReason:
        "No high- or medium-priority signal matched",
    };
  },
});

const createWorkItem = createStep({
  id: "create-work-item",
  inputSchema: classifiedRequestSchema,
  outputSchema: workItemSchema,

  execute: async ({ inputData }) => {
    return {
      workItemId: crypto.randomUUID(),
      title: inputData.title,
      description: inputData.description,
      affectedService: inputData.affectedService,
      priority: inputData.priority,
      classificationReason: inputData.classificationReason,
      status: "ready-for-review" as const,
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
  .then(classifyPriority)
  .then(createWorkItem)
  .commit();