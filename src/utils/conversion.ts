/**
 * Helper utilities for dynamic coin to BDT conversion
 */

export function getCoinsPerBDT(coinValueStr: string): number {
  if (!coinValueStr) return 100;
  const str = coinValueStr.trim();
  if (str.includes("=")) {
    const parts = str.split("=");
    const leftMatch = parts[0].match(/[\d.]+/);
    const rightMatch = parts[1].match(/[\d.]+/);
    if (leftMatch && rightMatch) {
      const leftNum = parseFloat(leftMatch[0]);
      const rightNum = parseFloat(rightMatch[0]);
      if (leftNum > 0 && rightNum > 0) {
        return leftNum / rightNum;
      }
    }
  } else {
    const match = str.match(/[\d.]+/);
    if (match) {
      const val = parseFloat(match[0]);
      if (val > 0) {
        // e.g., if user writes "5 BDT", 500 coins = 5 BDT => 100 coins per BDT
        return 500 / val;
      }
    }
  }
  return 100; // default fallback: 100 coins = 1 BDT
}

export function convertCoinsToBDT(coins: number, coinValueStr: string): string {
  if (!coins || coins <= 0) return "0";
  const rate = getCoinsPerBDT(coinValueStr);
  const bdt = coins / rate;
  if (bdt % 1 === 0) {
    return bdt.toString();
  }
  return bdt.toFixed(2);
}

export function formatRateFormula(coinValueStr: string): string {
  if (!coinValueStr) return "500 Coins = 5 BDT";
  const str = coinValueStr.trim();
  if (str.toLowerCase().includes("coin") || str.includes("=")) {
    return str;
  }
  const match = str.match(/[\d.]+/);
  if (match) {
    const bdtVal = parseFloat(match[0]);
    if (bdtVal > 0) {
      const coins = Math.round(bdtVal * 100);
      return `${coins} Coins = ${bdtVal} BDT`;
    }
  }
  return "500 Coins = 5 BDT";
}

export interface DailyStepReward {
  day: number;
  label: string;
  amount: number;
  badge: string;
}

export function calculate7DayDailyRewards(maxReward: number): DailyStepReward[] {
  const base = Math.max(10, Number(maxReward) || 15000);
  return [
    { day: 1, label: "D1", divisor: 64 },
    { day: 2, label: "D2", divisor: 32 },
    { day: 3, label: "D3", divisor: 16 },
    { day: 4, label: "D4", divisor: 8 },
    { day: 5, label: "D5", divisor: 4 },
    { day: 6, label: "D6", divisor: 2 },
    { day: 7, label: "D7", divisor: 1 },
  ].map((item) => {
    const amount = item.divisor === 1 ? base : Math.max(1, Math.round(base / item.divisor));
    return {
      day: item.day,
      label: item.label,
      amount,
      badge: item.day === 7 ? `👑 +${amount}` : `+${amount}`,
    };
  });
}
