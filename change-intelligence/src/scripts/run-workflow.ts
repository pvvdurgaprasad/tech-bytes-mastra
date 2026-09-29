import { mastra } from "../mastra";

const workflow = mastra.getWorkflow(
  "engineeringRequestWorkflow"
);

const run = await workflow.createRun();

const result = await run.start({
  inputData: {
    title: "Checkout API returning 500 errors",
    description:
      "Some payment requests fail with a 500 error.",
    affectedService: "Checkout API",
  },
});

console.log(JSON.stringify(result, null, 2));
