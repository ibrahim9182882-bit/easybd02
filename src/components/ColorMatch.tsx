import React, { useState, useEffect } from "react";
import { X, Trophy, RefreshCw, Sparkles } from "lucide-react";

interface ColorMatchProps {
  onClose: () => void;
  onWin: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
  rewardAmount: number;
}

const COLOR_OPTIONS = [
  { name: "RED", hex: "#ef4444", bg: "bg-red-500 hover:bg-red-600" },
  { name: "BLUE", hex: "#3b82f6", bg: "bg-blue-500 hover:bg-blue-600" },
  { name: "GREEN", hex: "#22c55e", bg: "bg-green-500 hover:bg-green-600" },
  { name: "YELLOW", hex: "#eab308", bg: "bg-yellow-500 hover:bg-yellow-600 text-slate-900" },
  { name: "PURPLE", hex: "#a855f7", bg: "bg-purple-500 hover:bg-purple-600" },
];

export default function ColorMatch({ onClose, onWin, onShowToast, rewardAmount }: ColorMatchProps) {
  const [score, setScore] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [currentColor, setCurrentColor] = useState({ name: "", hex: "" });
  const [timeLeft, setTimeLeft] = useState(15);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    generateChallenge();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      onShowToast("Time is up! Be faster next time.", "error");
    }
    return () => clearTimeout(timer);
  }, [isPlaying, timeLeft]);

  const generateChallenge = () => {
    const randomWordIdx = Math.floor(Math.random() * COLOR_OPTIONS.length);
    const randomColorIdx = Math.floor(Math.random() * COLOR_OPTIONS.length);

    setCurrentWord(COLOR_OPTIONS[randomWordIdx].name);
    setCurrentColor({
      name: COLOR_OPTIONS[randomColorIdx].name,
      hex: COLOR_OPTIONS[randomColorIdx].hex,
    });
  };

  const handleChoice = (colorName: string) => {
    if (!isPlaying) return;

    if (colorName === currentColor.name) {
      const nextScore = score + 1;
      setScore(nextScore);

      if (nextScore >= 6) {
        setIsPlaying(false);
        onShowToast("Amazing reflex! Stroop challenge completed!", "success");
        setTimeout(() => {
          onWin();
          onClose();
        }, 1000);
      } else {
        generateChallenge();
      }
    } else {
      setIsPlaying(false);
      onShowToast("Wrong color! Game Over.", "error");
    }
  };

  const handleReset = () => {
    setScore(0);
    setTimeLeft(15);
    setIsPlaying(true);
    generateChallenge();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06080f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col h-full justify-between py-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" /> Stroop Reflex
            </h2>
            <p className="text-slate-400 text-xs">Match the font color, not the text word!</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Panel */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wide">Reflex Timer</p>
            <p className="text-2xl font-black text-pink-500">{timeLeft}s</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wide">Target Clears</p>
            <p className="text-2xl font-black text-purple-400">{score}/6</p>
          </div>
        </div>

        {/* Core Stroop Challenge Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 flex flex-col items-center justify-center my-auto min-h-[160px] relative">
          {isPlaying ? (
            <span
              style={{ color: currentColor.hex }}
              className="text-5xl font-black tracking-widest uppercase transition-all duration-150 animate-pulse select-none"
            >
              {currentWord}
            </span>
          ) : (
            <span className="text-slate-500 font-bold">Game Over</span>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3 mt-6">
          <p className="text-slate-400 text-xs text-center font-semibold mb-2">Tap the correct visual font color:</p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.name}
                onClick={() => handleChoice(opt.name)}
                disabled={!isPlaying}
                className={`py-3.5 rounded-2xl font-black uppercase text-sm tracking-wider transition-all duration-200 active:scale-95 text-white ${opt.bg} shadow-md`}
              >
                {opt.name}
              </button>
            ))}
          </div>

          {!isPlaying && score < 6 && (
            <button
              onClick={handleReset}
              className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold uppercase text-xs tracking-wider transition active:scale-95"
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
