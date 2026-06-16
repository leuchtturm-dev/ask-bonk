import { createGitHubChannel } from "@flue/github";
import { handleGitHubDelivery } from "../app";
import type { Env } from "../types";

type GitHubChannelEnv = { Bindings: Env };

export const channel = createGitHubChannel<GitHubChannelEnv>({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "__missing_github_webhook_secret__",
  webhook: ({ c, delivery }) => handleGitHubDelivery(delivery, c.env),
});
