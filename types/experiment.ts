export interface Experiment {
  instrument: string | null;
  timeframe: string | null;
  entryCondition: string | null;
  exitCondition: string | null;
  holdingPeriod: string | null;
  filters: string[];
  researchQuestion: string;
  missingFields: string[];
  clarifyingQuestions: string[];
  confidence: number;
}

export interface ExperimentResult {
  summary: string;
  whatDataShows: string;
  whatWeConclude: string;
  nextQuestions: string[];
}

export interface BacktestTrade {
  id: number;
  symbol: string;
  entryDate: string;
  exitDate: string;
  returnPct: number;
}

export interface BacktestStats {
  winRate: number;
  averageReturn: number;
  tradeCount: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  stats: BacktestStats;
  whatDataShows: string;
  whatWeConclude: string;
}