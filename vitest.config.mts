import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          include: ["@cloudflare/sandbox", "@cloudflare/containers"],
        },
      },
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.test.jsonc" },
      },
    },
  },
});
