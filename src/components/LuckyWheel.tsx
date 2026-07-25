import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, RefreshCw, Coins } from "lucide-react";

interface LuckyWheelProps {
  onClose: () => void;
  onWin: (amount: number) => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

const WHEEL_SECTIONS = [
  { amount: 5, label: "5 Coins", color: "from-indigo-600 to-indigo-500", text: "text-white" },
  { amount: 15, label: "15 Coins", color: "from-purple-600 to-purple-500", text: "text-white" },
  { amount: 0, label: "Try Again", color: "from-slate-700 to-slate-600", text: "text-slate-300" },
  { amount: 25, label: "25 Coins", color: "from-pink-600 to-pink-500", text: "text-white" },
  { amount: 10, label: "10 Coins", color: "from-violet-600 to-violet-500", text: "text-white" },
  { amount: 50, label: "50 Jackpot!", color: "from-amber-500 to-yellow-500", text: "text-slate-950 font-black" },
  { amount: 8, label: "8 Coins", color: "from-fuchsia-600 to-fuchsia-500", text: "text-white" },
  { amount: 20, label: "20 Coins", color: "from-emerald-600 to-emerald-500", text: "text-white" },
];

export default function LuckyWheel({ onClose, onWin, onShowToast }: LuckyWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prizeIndex, setPrizeIndex] = useState<number | null>(null);
  const [spinningText, setSpinningText] = useState("Tap SPIN to test your luck!");

  const spinWheel = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setPrizeIndex(null);
    setSpinningText("Spinning the wheel...");

    // Sound effect
    try {
      const tick = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-mechanical-clog-spin-click-2615.mp3");
      tick.volume = 0.3;
      tick.play().catch(() => {});
    } catch (e) {}

    // Randomize a sector index (0 to 7)
    const targetSector = Math.floor(Math.random() * WHEEL_SECTIONS.length);
    
    // Each sector takes 45 degrees (360 / 8)
    // To land exactly in the middle of a sector, calculate the angle:
    // Section 0 is at 0-45 deg. To align the marker at the top (90 or 270 deg depending on reference):
    // Let's make it simpler: base degrees is SectionIndex * 45.
    // Let's add multiple full spins (e.g. 5 to 8 full spins) for momentum.
    const sectorAngle = 360 / WHEEL_SECTIONS.length;
    const additionalSpins = 5 + Math.floor(Math.random() * 4); // 5 to 8 spins
    
    // Calculate final rotation degrees. 
    // We spin clockwise, pointer is at the very top (90 degrees or index offset)
    // Pointer at top points to index: Math.round((360 - (deg % 360)) / 45) % 8
    // So to land on targetSector: targetDegrees = (360 - (targetSector * 45)) - 90
    // Let's align cleanly:
    const targetDegrees = 360 * additionalSpins + (360 - (targetSector * sectorAngle));
    
    setRotation(targetDegrees);

    setTimeout(() => {
      setIsSpinning(false);
      setPrizeIndex(targetSector);
      const prize = WHEEL_SECTIONS[targetSector];
      
      if (prize.amount > 0) {
        setSpinningText(`Amazing! You won ${prize.amount} Coins!`);
        onShowToast(`Lucky Wheel: Won ${prize.amount} Coins!`, "success");
        setTimeout(() => {
          onWin(prize.amount);
          onClose();
        }, 1500);
      } else {
        setSpinningText("Oh no, Try Again! Next spin could be the Jackpot!");
        onShowToast("Try Again!", "info");
      }
    }, 4000); // match duration of CSS transition
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f19] flex flex-col items-center justify-center p-6">
      {/* Background Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm flex flex-col h-full justify-between py-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
              Lucky Spin Wheel
            </h2>
            <p className="text-slate-400 text-xs">Spin to win premium rewards</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wheel & Spinner Container */}
        <div className="relative flex flex-col items-center justify-center my-auto py-8">
          {/* Glowing Outer Rim */}
          <div className="absolute w-[304px] h-[304px] rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 opacity-20 blur-md animate-pulse"></div>
          
          {/* Metal border rim */}
          <div className="relative w-[290px] h-[290px] rounded-full bg-slate-950 border-[6px] border-slate-800 flex items-center justify-center shadow-2xl overflow-hidden">
            
            {/* The Rotating Wheel */}
            <div
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)" : "none",
              }}
              className="absolute w-full h-full rounded-full"
            >
              {WHEEL_SECTIONS.map((sec, idx) => {
                const rotationAngle = idx * 45;
                return (
                  <div
                    key={idx}
                    style={{
                      transform: `rotate(${rotationAngle}deg)`,
                      clipPath: "polygon(50% 50%, 30.5% 0, 69.5% 0)",
                    }}
                    className={`absolute inset-0 bg-gradient-to-b ${sec.color} flex justify-center pt-5`}
                  >
                    {/* Rotate text so it looks aligned correctly in the slice */}
                    <div className={`transform rotate-0 text-[10px] font-extrabold tracking-wide text-center w-20 uppercase ${sec.text}`}>
                      {sec.label}
                    </div>
                  </div>
                );
              })}

              {/* Inner divider lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" viewBox="0 0 100 100">
                <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.5" />
                <line x1="14.6" y1="14.6" x2="85.4" y2="85.4" stroke="white" strokeWidth="0.5" />
                <line x1="14.6" y1="85.4" x2="85.4" y2="14.6" stroke="white" strokeWidth="0.5" />
              </svg>
            </div>

            {/* Inner Glowing Center Core */}
            <div className="absolute w-14 h-14 rounded-full bg-slate-900 border-4 border-slate-800 flex items-center justify-center shadow-lg z-10">
              <Coins className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
            </div>
          </div>

          {/* Pointer indicator at the top */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[20px] border-t-pink-500 drop-shadow-lg filter"></div>
            <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow"></div>
          </div>
        </div>

        {/* Control Button & Interactive Info */}
        <div className="space-y-4 text-center">
          <div className="bg-slate-900/60 border border-slate-800/80 px-4 py-3 rounded-2xl min-h-[50px] flex items-center justify-center">
            <p className="text-slate-300 text-xs font-semibold tracking-wide">
              {spinningText}
            </p>
          </div>

          <button
            onClick={spinWheel}
            disabled={isSpinning}
            className={`w-full py-4 rounded-2xl font-extrabold text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
              isSpinning
                ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-90 active:scale-95 text-white shadow-pink-500/10"
            }`}
          >
            {isSpinning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Spinning...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-white text-white" />
                <span>Spin Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
