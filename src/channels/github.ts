import { createGitHubChannel } from "@flue/github";
import { handleGitHubDelivery } from "../app";
import type { Env } from "../types";

type GitHubChannelEnv = { Bindings: Env };

// If the runtime secret binding is missing, use an unguessable value so the
// generated Flue webhook route fails closed instead of accepting a public secret.
const missingWebhookSecret = crypto.randomUUID();

export const channel = createGitHubChannel<GitHubChannelEnv>({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || missingWebhookSecret,
  webhook: ({ c, delivery }) => handleGitHubDelivery(delivery, c.env),
});
