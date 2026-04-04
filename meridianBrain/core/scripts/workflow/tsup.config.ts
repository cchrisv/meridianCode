import { defineConfig } from "tsup";

export default defineConfig([
  // Main library bundle
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    dts: false, // Disabled temporarily due to Wiki API type issues
    sourcemap: true,
    clean: true,
    target: "node18",
    splitting: false,
    shims: true,
  },
  // CLI bundles (shebang already in source files)
  {
    entry: {
      "cli/ado-tools": "cli/ado-tools.ts",
      "cli/crm-tools": "cli/crm-tools.ts",
      "cli/wiki-tools": "cli/wiki-tools.ts",
      "cli/workflow-tools": "cli/workflow-tools.ts",
      "cli/report-tools": "cli/report-tools.ts",
      "cli/team-tools": "cli/team-tools.ts",
      "cli/template-tools": "cli/template-tools.ts",
      "cli/pr-tools": "cli/pr-tools.ts",
      "cli/wiki-engine-tools": "cli/wiki-engine-tools.ts",
      "cli/knowledge-tools": "cli/knowledge-tools.ts",
      "cli/integration-tools": "cli/integration-tools.ts",
      "cli/marketing-automation-tools": "cli/marketing-automation-tools.ts",
      "cli/contact-center-tools": "cli/contact-center-tools.ts",
      "cli/portal-tools": "cli/portal-tools.ts",
    },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "node18",
    splitting: false,
    shims: true,
  },
]);
