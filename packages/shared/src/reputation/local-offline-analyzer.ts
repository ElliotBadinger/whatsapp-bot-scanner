import type { LocalThreatDatabase } from "./local-threat-db";
import { advancedHeuristics } from "./advanced-heuristics";

export interface LocalOfflineAnalysis {
  verdict: "benign" | "suspicious" | "malicious";
  score: number;
  reasons: string[];
  components: {
    heuristicsScore: number;
    localThreatScore: number;
  };
}

export async function localOfflineAnalyze(
  url: string,
  localThreatDb: Pick<LocalThreatDatabase, "check">,
): Promise<LocalOfflineAnalysis> {
  const heuristics = await advancedHeuristics(url);
  const localThreats = await localThreatDb.check(url);

  const score = heuristics.score + localThreats.score;
  const reasons = [...heuristics.reasons, ...localThreats.reasons];

  const verdict: LocalOfflineAnalysis["verdict"] =
    score >= 2.0 ? "malicious" : score >= 0.8 ? "suspicious" : "benign";

  return {
    verdict,
    score,
    reasons,
    components: {
      heuristicsScore: heuristics.score,
      localThreatScore: localThreats.score,
    },
  };
}
