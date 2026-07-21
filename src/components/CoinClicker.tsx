import React, { useState, useEffect } from "react";
import { X, Trophy, Sparkles, Coins } from "lucide-react";

interface CoinClickerProps {
  onClose: () => void;
  onWin: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
  rewardAmount: number;
}

const TARGET_CLICKS = 40;
const TIME_LIMIT = 10; // seconds

export default function CoinClicker({ onClose, onWin, onShowToast, rewardAmount }: CoinClickerProps) {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      setHasFinished(true);
      if (clicks >= TARGET_CLICKS) {
        onShowToast("Fantastic speed! You successfully mined the reward!", "success");
        setTimeout(() => {
          onWin();
          onClose();
        }, 1000);
      } else {
        onShowToast("Too slow! Tap faster next time.", "error");
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, timeLeft, clicks]);

  const handleCoinTap = () => {
    if (!isPlaying && !hasFinished) {
      setIsPlaying(true);
    }
    if (hasFinished) return;

    setClicks((prev) => {
      const nextClicks = prev + 1;
      if (nextClicks >= TARGET_CLICKS && timeLeft > 0) {
        setIsPlaying(false);
        setHasFinished(true);
        onShowToast("Mission complete! Golden coin fully mined!", "success");
        setTimeout(() => {
          onWin();
          onClose();
        }, 1000);
      }
      return nextClicks;
    });

    // Simple haptic trigger / audio simulation
    try {
      const snd = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3");
      snd.volume = 0.2;
      snd.play().catch(() => {});
    } catch (e) {}
  };

  const handleRestart = () => {
    setClicks(0);
    setTimeLeft(TIME_LIMIT);
    setIsPlaying(false);
    setHasFinished(false);
  };

  const progressPercentage = Math.min((clicks / TARGET_CLICKS) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 bg-[#06080f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col h-full justify-between py-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" /> Golden Tap Miner
            </h2>
            <p className="text-slate-400 text-xs">Tap the golden coin {TARGET_CLICKS} times in {TIME_LIMIT} seconds!</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Board Stats */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wide">Time Remaining</p>
            <p className="text-2xl font-black text-pink-500">{timeLeft}s</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wide">Taps Made</p>
            <p className="text-2xl font-black text-yellow-400">{clicks}/{TARGET_CLICKS}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-900 border border-slate-800 h-4 rounded-full overflow-hidden mb-8 relative">
          <div
            style={{ width: `${progressPercentage}%` }}
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-100"
          ></div>
        </div>

        {/* Golden Tapping Area */}
        <div className="relative flex flex-col items-center justify-center my-auto">
          {/* Glowing Aura */}
          <div className={`absolute w-44 h-44 rounded-full bg-yellow-400/20 blur-2xl transition duration-500 ${isPlaying ? "scale-125 animate-pulse" : "scale-100"}`}></div>

          <button
            onClick={handleCoinTap}
            className={`w-36 h-36 rounded-full bg-gradient-to-tr from-yellow-500 via-amber-400 to-yellow-300 border-8 border-slate-950 flex items-center justify-center shadow-2xl transform active:scale-90 transition-all duration-75 select-none focus:outline-none ${
              hasFinished ? "cursor-not-allowed filter grayscale" : "hover:scale-105"
            }`}
          >
            <Coins className="w-16 h-16 text-white drop-shadow-md animate-bounce" />
          </button>

          <p className="text-slate-400 text-xs mt-6 font-semibold animate-pulse">
            {!isPlaying && !hasFinished ? "Tap Coin to START Mining!" : "TAP FAST!"}
          </p>
        </div>

        {/* Control Button */}
        <div className="text-center mt-6">
          {hasFinished && clicks < TARGET_CLICKS && (
            <button
              onClick={handleRestart}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 font-extrabold uppercase text-xs tracking-wider transition active:scale-95"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
