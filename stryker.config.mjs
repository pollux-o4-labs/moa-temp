const config = {
  testRunner: "command",
  commandRunner: {
    command:
      "node --experimental-strip-types --test-concurrency=4 --test tests/plan.test.mjs tests/plan-property.test.mjs tests/plan-merge.test.mjs",
  },
  mutate: ["lib/plan.ts", "lib/plan-commands.ts", "lib/plan-merge.ts"],
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "html", "json"],
  tempDirName: ".stryker-tmp",
  incremental: true,
  incrementalFile: ".stryker-incremental.json",
  thresholds: { high: 80, low: 50, break: 50 },
};

export default config;
