import React, { useState, useEffect } from "react";
import { X, Trophy, Brain } from "lucide-react";

interface MemoryMatchProps {
  onClose: () => void;
  onWin: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
  rewardAmount: number;
}

const CARD_SYMBOLS = ["🍒", "🍉", "🍋", "🍊", "🍓", "🍇"];

export default function MemoryMatch({ onClose, onWin, onShowToast, rewardAmount }: MemoryMatchProps) {
  const [cards, setCards] = useState<{ id: number; symbol: string; isFlipped: boolean; isMatched: boolean }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    // Create duplicated deck
    const deck = [...CARD_SYMBOLS, ...CARD_SYMBOLS]
      .map((symbol, index) => ({
        id: index,
        symbol,
        isFlipped: false,
        isMatched: false,
      }))
      .sort(() => Math.random() - 0.5);

    setCards(deck);
    setSelected([]);
    setMoves(0);
  };

  const handleCardClick = (index: number) => {
    if (cards[index].isFlipped || cards[index].isMatched || selected.length >= 2) return;

    // Flip card
    const updatedCards = [...cards];
    updatedCards[index].isFlipped = true;
    setCards(updatedCards);

    const nextSelected = [...selected, index];
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      setMoves((prev) => prev + 1);
      const [firstIdx, secondIdx] = nextSelected;

      if (updatedCards[firstIdx].symbol === updatedCards[secondIdx].symbol) {
        // Matched!
        setTimeout(() => {
          const matchedCards = [...cards];
          matchedCards[firstIdx].isMatched = true;
          matchedCards[secondIdx].isMatched = true;
          setCards(matchedCards);
          setSelected([]);

          // Check win
          if (matchedCards.every((c) => c.isMatched)) {
            onShowToast("Memory cleared successfully!", "success");
            setTimeout(() => {
              onWin();
              onClose();
            }, 800);
          }
        }, 500);
      } else {
        // Not a match, flip back
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[firstIdx].isFlipped = false;
          resetCards[secondIdx].isFlipped = false;
          setCards(resetCards);
          setSelected([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06080f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col h-full justify-between py-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center gap-2">
              <Brain className="w-6 h-6 text-emerald-400" /> Memory Cards
            </h2>
            <p className="text-slate-400 text-xs">Pair all matching fruits to win!</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Board Stats */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 text-center flex justify-between items-center my-4">
          <p className="text-slate-300 text-xs font-semibold">
            Prize: <span className="text-yellow-400 font-extrabold">{rewardAmount} Coins</span>
          </p>
          <p className="text-slate-300 text-xs font-semibold">
            Moves Made: <span className="text-indigo-400 font-extrabold">{moves}</span>
          </p>
        </div>

        {/* 4x3 Grid */}
        <div className="grid grid-cols-4 gap-3 my-auto">
          {cards.map((card, idx) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(idx)}
              className={`aspect-[3/4] rounded-2xl flex items-center justify-center text-2xl font-extrabold shadow-md transition-all duration-300 transform border ${
                card.isMatched
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 opacity-60 scale-95"
                  : card.isFlipped
                  ? "bg-slate-800 border-indigo-500/50 scale-100 rotate-0"
                  : "bg-gradient-to-tr from-slate-900 to-slate-850 border-white/5 hover:border-indigo-500/20 active:scale-95 hover:scale-102"
              }`}
            >
              {card.isFlipped || card.isMatched ? (
                <span>{card.symbol}</span>
              ) : (
                <span className="text-indigo-400 font-extrabold text-sm font-mono">?</span>
              )}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="text-center mt-6">
          <button
            onClick={initializeGame}
            className="text-xs font-bold text-slate-400 hover:text-white underline transition"
          >
            Reset Board
          </button>
        </div>
      </div>
    </div>
  );
}
