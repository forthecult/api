/**
 * Venice / OpenAI-style chat sampling: pass at most one of `temperature` or `topP`
 * to avoid conflicting nucleus controls.
 */
export function normalizeVeniceSampling(
  temperature: number | undefined,
  topP: number | undefined,
): { temperature?: number; topP?: number } {
  const hasT =
    typeof temperature === "number" &&
    Number.isFinite(temperature) &&
    temperature >= 0 &&
    temperature <= 2;
  const hasP =
    typeof topP === "number" &&
    Number.isFinite(topP) &&
    topP > 0 &&
    topP <= 1;

  if (hasT && hasP) {
    return { temperature: temperature as number };
  }
  if (hasT) return { temperature: temperature as number };
  if (hasP) return { topP: topP as number };
  return {};
}
