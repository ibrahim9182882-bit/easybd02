import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, RefreshCw, Trophy, Coins, Sparkles, ShieldCheck } from "lucide-react";

interface MultiAdClaimProps {
  rewardAmount: number;
  requiredAds: number;
  gameTitle: string;
  onClaimComplete: (amount: number) => void;
  onCancel: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function MultiAdClaim({
  rewardAmount,
  requiredAds,
  gameTitle,
  onClaimComplete,
  onCancel,
  onShowToast,
}: MultiAdClaimProps) {
  const [adsWatched, setAdsWatched] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAdPlaying && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isAdPlaying && countdown === 0) {
      setIsAdPlaying(false);
      setAdsWatched((prev) => prev + 1);
      onShowToast("Ad completed successfully! Credit updated.", "success");
    }
    return () => clearTimeout(timer);
  }, [isAdPlaying, countdown]);

  const startAdSequence = () => {
    if (isAdPlaying) return;

    // Trigger Monetag Ad integration
    if (typeof (window as any).show_11346256 === "function") {
      onShowToast("Launching Sponsor Ad...", "info");
      const isPopup = Math.random() < 0.5;
      if (isPopup) {
        (window as any).show_11346256("pop")
          .then(() => {
            onShowToast("Ad verified!", "success");
          })
          .catch(() => {
            onShowToast("Unable to load ad. Running offline fallback.", "info");
          });
      } else {
        try {
          (window as any).show_11346256({
            type: "inApp",
            inAppSettings: {
              frequency: 2,
              capping: 0.1,
              interval: 30,
              timeout: 5,
              everyPage: false
            }
          });
          onShowToast("Ad verified!", "success");
        } catch (e) {
          onShowToast("Unable to load ad. Running offline fallback.", "info");
        }
      }
    } else {
      onShowToast("Offline Simulation: Ads loading...", "info");
    }

    setCountdown(15);
    setIsAdPlaying(true);
  };

  const handleFinalClaim = () => {
    if (adsWatched < requiredAds) {
      onShowToast("Please watch all required ads first!", "error");
      return;
    }
    onClaimComplete(rewardAmount);
  };

  const percentComplete = (adsWatched / requiredAds) * 100;
  const countdownPercent = ((15 - countdown) / 15) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-[#06080f]/98 backdrop-blur-md flex flex-col items-center justify-center p-6">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm glass-card border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 to-indigo-500/5 pointer-events-none"></div>

        {/* Cancel option */}
        <button
          onClick={onCancel}
          disabled={isAdPlaying}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 px-3.5 py-1 rounded-full text-yellow-400 text-[10px] font-black uppercase tracking-wider mb-5 flex items-center gap-1">
          <Trophy className="w-3 h-3 fill-yellow-400" /> Reward Locked
        </div>

        {/* Content */}
        <div className="space-y-3 mb-6 relative z-10">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 tracking-tight">
            Claim Your Reward!
          </h2>
          <p className="text-slate-400 text-xs font-semibold px-4">
            You completed <span className="text-white font-bold">{gameTitle}</span>! Complete the verification ads below to unlock your reward.
          </p>
        </div>

        {/* Big Coin Box */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-6">
          <div className="absolute inset-0 bg-yellow-500/15 rounded-full blur-xl animate-pulse"></div>
          <div className="w-28 h-28 bg-gradient-to-tr from-yellow-500 to-amber-500 rounded-full flex flex-col items-center justify-center border-4 border-slate-950 shadow-xl">
            <Coins className="w-12 h-12 text-white fill-white drop-shadow-md" />
            <span className="text-2xl font-black text-white mt-1">+{rewardAmount}</span>
            <span className="text-[9px] text-yellow-100 font-bold uppercase tracking-widest">Coins</span>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="w-full space-y-2 mb-6">
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-slate-400 font-semibold">Ad Verification Progress</span>
            <span className="text-pink-400 font-black">{adsWatched} / {requiredAds} Done</span>
          </div>

          <div className="w-full bg-slate-950 border border-slate-900 h-3 rounded-full overflow-hidden relative">
            <div
              style={{ width: `${percentComplete}%` }}
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-300"
            ></div>
          </div>
        </div>

        {/* Ad countdown or trigger buttons */}
        <div className="w-full space-y-4">
          {isAdPlaying ? (
            <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-2xl flex flex-col items-center justify-center space-y-3 min-h-[100px]">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#ec4899"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * countdownPercent) / 100}
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute text-sm font-black text-white">{countdown}</span>
              </div>
              <p className="text-slate-400 text-xs font-semibold animate-pulse">
                Sponsor Ad is playing... Keep this page open!
              </p>
            </div>
          ) : (
            <>
              {adsWatched < requiredAds ? (
                <button
                  onClick={startAdSequence}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-extrabold uppercase text-xs tracking-wider transition active:scale-95 shadow-lg shadow-pink-500/10 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Watch Verification Ad ({adsWatched + 1}/{requiredAds})</span>
                </button>
              ) : (
                <button
                  onClick={handleFinalClaim}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold uppercase text-xs tracking-wider transition active:scale-95 shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 animate-bounce"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Claim {rewardAmount} Coins Now!</span>
                </button>
              )}
            </>
          )}

          <p className="text-[10px] text-slate-500 font-semibold tracking-wide">
            Sponsor ads support our game payouts. Thank you!
          </p>
        </div>
      </div>
    </div>
  );
}
