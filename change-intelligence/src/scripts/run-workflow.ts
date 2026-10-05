import { mastra } from "../mastra";
import { humanApprovalGate } from "../mastra/workflows/engineering-request-workflow";

const workflow = mastra.getWorkflow(
  "engineeringRequestWorkflow"
);

const run = await workflow.createRun();

const result = await run.start({
  inputData: {
    title: "Possible duplicate settlement records",
    description:
      "Checkout remains available, but some completed payments appear to generate duplicate settlement records.",
    affectedService: "checkout-api",
  },
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "suspended") {
  const [stepPath] = result.suspended;

  const suspendedStepId = stepPath[0];

  const reviewPacket =
    result.steps[suspendedStepId]
      .suspendPayload;

  console.log("Approval required:");

  console.log(
    JSON.stringify(reviewPacket, null, 2)
  );
}

/* const resumedResult = await run.resume({
  step: humanApprovalGate,

  resumeData: {
    decision: "approved",

    reviewer: "platform-duty-manager",

    comment:
      "Approved for investigation. " +
      "Do not mutate settlement records.",
  },
});

console.log(
  JSON.stringify(resumedResult, null, 2)
); */

const resumedResult = await run.resume({
  step: humanApprovalGate,

  resumeData: {
    decision: "rejected",

    reviewer: "platform-duty-manager",

    comment:
      "Insufficient evidence. Confirm whether " +
      "the duplicate records are source events " +
      "or reporting-layer projections.",
  },
});

console.log(
  JSON.stringify(resumedResult, null, 2)
);