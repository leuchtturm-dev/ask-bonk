// flue-blueprint: channel/slack@1
import { Result } from "better-result";
import { createSlackChannel } from "@flue/slack";
import { WebClient, type WebClientOptions } from "@slack/web-api";
import { SlackAPIError } from "../errors";
import type { Env } from "../types";

type SlackChannelEnv = { Bindings: Env };

export interface SlackMessageRef {
  channelId: string;
  messageTs: string;
}

export interface SlackStatusContext {
  owner: string;
  repo: string;
  runId: number;
  runUrl: string;
  issueNumber: number;
  status: string;
  actor?: string;
}

interface SlackMessageInput {
  channelId?: string;
  threadTs?: string;
  text: string;
}

// If the runtime secret binding is missing, use an unguessable value so the
// generated Flue Slack routes fail closed instead of accepting unsigned traffic.
const missingSigningSecret = crypto.randomUUID();

export const client = new WebClient(process.env.SLACK_BOT_TOKEN);

export const channel = createSlackChannel<SlackChannelEnv>({
  signingSecret: process.env.SLACK_SIGNING_SECRET || missingSigningSecret,

  // Path: /channels/slack/commands
  async commands({ c, payload }) {
    if (payload.command === "/bonk-status") {
      return c.json({
        response_type: "ephemeral",
        text: "Bonk Slack integration is installed. Workflow status updates are sent from GitHub-triggered runs when SLACK_STATUS_CHANNEL_ID is configured.",
      });
    }

    return c.json({ response_type: "ephemeral", text: `Unknown command: ${payload.command}` });
  },
});

export function createSlackClient(env: Env, options: WebClientOptions = {}): WebClient {
  return new WebClient(env.SLACK_BOT_TOKEN, { timeout: 5000, ...options });
}

export function isSlackStatusConfigured(env: Env): boolean {
  return !!env.SLACK_BOT_TOKEN && !!env.SLACK_STATUS_CHANNEL_ID;
}

export function formatBonkStatusMessage(context: SlackStatusContext): string {
  const repo = `${context.owner}/${context.repo}`;
  const actor = context.actor ? ` by ${context.actor}` : "";
  const prefix = statusPrefix(context.status);
  return `${prefix} Bonk run for ${repo}#${context.issueNumber}${actor}: ${context.status}\n${context.runUrl}`;
}

export async function postSlackMessage(
  env: Env,
  input: SlackMessageInput,
  options: WebClientOptions = {},
): Promise<Result<SlackMessageRef, SlackAPIError>> {
  const channelId = input.channelId ?? env.SLACK_STATUS_CHANNEL_ID;
  if (!env.SLACK_BOT_TOKEN || !channelId) {
    return Result.err(
      new SlackAPIError({
        operation: "chat.postMessage",
        cause: new Error("Slack bot token or channel is not configured"),
      }),
    );
  }

  return Result.tryPromise({
    try: async () => {
      const result = await createSlackClient(env, options).chat.postMessage({
        channel: channelId,
        thread_ts: input.threadTs,
        text: input.text,
        unfurl_links: false,
        unfurl_media: false,
      });
      if (!result.channel || !result.ts) {
        throw new Error("Slack did not return a message reference");
      }
      return { channelId: result.channel, messageTs: result.ts };
    },
    catch: (error) => new SlackAPIError({ operation: "chat.postMessage", cause: error }),
  });
}

export async function updateSlackMessage(
  env: Env,
  ref: SlackMessageRef,
  text: string,
  options: WebClientOptions = {},
): Promise<Result<SlackMessageRef, SlackAPIError>> {
  if (!env.SLACK_BOT_TOKEN) {
    return Result.err(
      new SlackAPIError({
        operation: "chat.update",
        cause: new Error("Slack bot token is not configured"),
      }),
    );
  }

  return Result.tryPromise({
    try: async () => {
      const result = await createSlackClient(env, options).chat.update({
        channel: ref.channelId,
        ts: ref.messageTs,
        text,
      });
      return {
        channelId: result.channel ?? ref.channelId,
        messageTs: result.ts ?? ref.messageTs,
      };
    },
    catch: (error) => new SlackAPIError({ operation: "chat.update", cause: error }),
  });
}

export async function postBonkStatusMessage(
  env: Env,
  context: SlackStatusContext,
): Promise<Result<SlackMessageRef | null, SlackAPIError>> {
  if (!isSlackStatusConfigured(env)) return Result.ok(null);
  return postSlackMessage(env, { text: formatBonkStatusMessage(context) });
}

export async function updateBonkStatusMessage(
  env: Env,
  ref: SlackMessageRef | undefined,
  context: SlackStatusContext,
): Promise<Result<SlackMessageRef | null, SlackAPIError>> {
  if (!isSlackStatusConfigured(env)) return Result.ok(null);
  if (!ref) return postBonkStatusMessage(env, context);
  return updateSlackMessage(env, ref, formatBonkStatusMessage(context));
}

function statusPrefix(status: string): string {
  switch (status) {
    case "running":
      return "🚀";
    case "waiting":
      return "⏳";
    case "success":
      return "✅";
    case "cancelled":
    case "skipped":
      return "⚠️";
    default:
      return "❌";
  }
}
