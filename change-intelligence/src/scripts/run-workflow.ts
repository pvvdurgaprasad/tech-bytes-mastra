import { mastra } from "../mastra";

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
