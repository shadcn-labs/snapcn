/**
 * Token usage per studio turn, by stage — what a video costs to make.
 * Each AI call adds to the turn's tally; the route returns it in development.
 */
export interface StageUsage {
  stage: string;
  model: string;
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}

export type UsageSink = (u: StageUsage) => void;

interface SdkUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
  outputTokenDetails?: { reasoningTokens?: number };
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export function toStage(
  stage: string,
  model: string,
  u: SdkUsage | undefined,
): StageUsage {
  return {
    stage,
    model,
    input: u?.inputTokens ?? 0,
    cachedInput:
      u?.inputTokenDetails?.cacheReadTokens ?? u?.cachedInputTokens ?? 0,
    output: u?.outputTokens ?? 0,
    reasoning:
      u?.outputTokenDetails?.reasoningTokens ?? u?.reasoningTokens ?? 0,
  };
}
