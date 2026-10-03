import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const serviceContextSchema = z.object({
  service: z.string(),
  tier: z.enum(["critical", "important", "standard"]),
  owner: z.string(),
  dataSensitivity: z.enum([
    "restricted",
    "internal",
    "public",
  ]),
});

const serviceCatalogue: Record<
  string,
  z.infer<typeof serviceContextSchema>
> = {
  "checkout-api": {
    service: "checkout-api",
    tier: "critical",
    owner: "Commerce Platform",
    dataSensitivity: "restricted",
  },

  "notification-service": {
    service: "notification-service",
    tier: "important",
    owner: "Customer Communications",
    dataSensitivity: "internal",
  },

  "documentation-site": {
    service: "documentation-site",
    tier: "standard",
    owner: "Developer Experience",
    dataSensitivity: "public",
  },
};

export const serviceContextTool = createTool({
  id: "get-service-context",

  description:
    "Returns service tier, owner, and data sensitivity " +
    "for an engineering service identifier.",

  inputSchema: z.object({
    service: z.string(),
  }),

  outputSchema: serviceContextSchema,

  execute: async ({ service }) => {
    const normalizedService = service
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    return (
      serviceCatalogue[normalizedService] ?? {
        service: normalizedService,
        tier: "standard" as const,
        owner: "unassigned",
        dataSensitivity: "internal" as const,
      }
    );
  },
});