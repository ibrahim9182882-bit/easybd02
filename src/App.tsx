import React, { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Coins,
  Flame,
  Gamepad2,
  Search,
  Shapes,
  Play,
  Users,
  TrendingUp,
  Landmark,
  ChevronDown,
  Gift,
  Copy,
  Send,
  Home,
  Wallet,
  User as UserIcon,
  Check,
  Clock,
  Youtube,
  Instagram,
  MousePointer,
  PlayCircle,
  HelpCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ref as dbRef, onValue, onDisconnect, set, serverTimestamp as rtdbServerTimestamp } from "firebase/database";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";

import { db, auth, rtdb } from "./firebase";
import { UserProfile, GlobalSettings, EarningRecord, WithdrawalRecord, ToastMessage } from "./types";
import ToastContainer from "./components/ToastContainer";
import ImageFinder from "./components/ImageFinder";
import TicTacToe from "./components/TicTacToe";
import MathSolve from "./components/MathSolve";
import LuckyWheel from "./components/LuckyWheel";

import MemoryMatch from "./components/MemoryMatch";
import CoinClicker from "./components/CoinClicker";
import ColorMatch from "./components/ColorMatch";
import MultiAdClaim from "./components/MultiAdClaim";
import AdminDashboard from "./components/AdminDashboard";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            photo_url?: string;
          };
          start_param?: string;
        };
      };
    };
    show_11346256?: (arg?: any) => Promise<void>;
  }
}

const artifactRoot = "artifacts/easybd-2fc02";

export default function App() {
  // Auth & Profile
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Connecting to EasyEarnBD...");
  const [activeUsersCount, setActiveUsersCount] = useState<number | string>("...");

  // Navigation
  const [activePage, setActivePage] = useState<"home" | "refer" | "wallet" | "profile">("home");

  // Global Settings
  const [settings, setSettings] = useState<GlobalSettings>({
    coinValue: "1 BDT",
    paymentMethods: ["bKash", "Nagad", "Bank"],
    gameReward: 10,
    tttReward: 10,
    mathReward: 10,
    referralBonus: 500,
    signupBonus: 100,
    minWithdraw: 10000,
    socials: {},
  });

  // Dynamic lists
  const [earningHistory, setEarningHistory] = useState<EarningRecord[]>([]);
  const [txHistory, setTxHistory] = useState<WithdrawalRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Games and Overlay Modals
  const [activeGame, setActiveGame] = useState<
    | "image-finder"
    | "ttt"
    | "math"
    | "lucky-wheel"
    | "memory-match"
    | "coin-clicker"
    | "color-match"
    | null
  >(null);
  const [multiAdClaim, setMultiAdClaim] = useState<{
    amount: number;
    requiredAds: number;
    gameTitle: string;
  } | null>(null);
  const [gamesPlayedSession, setGamesPlayedSession] = useState(0);
  const [pendingReward, setPendingReward] = useState<{ amount: number; source: string } | null>(null);
  const [showClaimOverlay, setShowClaimOverlay] = useState(false);
  const [showAdClickModal, setShowAdClickModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Ad verification state
  const [isWaitingForAdClick, setIsWaitingForAdClick] = useState(false);
  const [adClickStartTime, setAdClickStartTime] = useState<number>(0);

  // Daily Check-In & Sponsor Ad States
  const [dailyCountdown, setDailyCountdown] = useState<string>("");
  const [canClaimDaily, setCanClaimDaily] = useState<boolean>(true);
  const [isClaimingDaily, setIsClaimingDaily] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<string>("");
  const [canClaimAd, setCanClaimAd] = useState<boolean>(true);
  const [showAdVerificationModal, setShowAdVerificationModal] = useState(false);
  const [adVerifyTimeLeft, setAdVerifyTimeLeft] = useState(10);
  const [adVerificationStep, setAdVerificationStep] = useState<number>(1);
  const [isAdTimerRunning, setIsAdTimerRunning] = useState<boolean>(false);

  const checkDailyClaimable = (): { claimable: boolean; remainingMs: number } => {
    if (!userData || !userData.lastCheckIn) {
      return { claimable: true, remainingMs: 0 };
    }
    
    let lastCheckInMs = 0;
    if (userData.lastCheckIn.seconds) {
      lastCheckInMs = userData.lastCheckIn.seconds * 1000;
    } else if (userData.lastCheckIn instanceof Date) {
      lastCheckInMs = userData.lastCheckIn.getTime();
    } else {
      lastCheckInMs = new Date(userData.lastCheckIn).getTime();
    }
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const elapsed = now - lastCheckInMs;
    
    if (elapsed >= twentyFourHours) {
      return { claimable: true, remainingMs: 0 };
    } else {
      return { claimable: false, remainingMs: twentyFourHours - elapsed };
    }
  };

  const checkAdClaimable = (): { claimable: boolean; remainingMs: number } => {
    if (!userData || !userData.lastAdClick) {
      return { claimable: true, remainingMs: 0 };
    }
    
    let lastAdClickMs = 0;
    if (userData.lastAdClick.seconds) {
      lastAdClickMs = userData.lastAdClick.seconds * 1000;
    } else if (userData.lastAdClick instanceof Date) {
      lastAdClickMs = userData.lastAdClick.getTime();
    } else {
      lastAdClickMs = new Date(userData.lastAdClick).getTime();
    }
    
    const now = Date.now();
    const cooldown = 60 * 60 * 1000; // 1 hour
    const elapsed = now - lastAdClickMs;
    
    if (elapsed >= cooldown) {
      return { claimable: true, remainingMs: 0 };
    } else {
      return { claimable: false, remainingMs: cooldown - elapsed };
    }
  };

  useEffect(() => {
    if (!userData) return;
    
    const updateCountdowns = () => {
      // 1. Daily check-in
      const dailyRes = checkDailyClaimable();
      setCanClaimDaily(dailyRes.claimable);
      if (dailyRes.claimable) {
        setDailyCountdown("");
      } else {
        const hours = Math.floor(dailyRes.remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((dailyRes.remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((dailyRes.remainingMs % (1000 * 60)) / 1000);
        setDailyCountdown(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }

      // 2. Sponsor Ad Click
      const adRes = checkAdClaimable();
      setCanClaimAd(adRes.claimable);
      if (adRes.claimable) {
        setAdCountdown("");
      } else {
        const minutes = Math.floor(adRes.remainingMs / (1000 * 60));
        const seconds = Math.floor((adRes.remainingMs % (1000 * 60)) / 1000);
        setAdCountdown(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateCountdowns();
    const timer = setInterval(updateCountdowns, 1000);
    return () => clearInterval(timer);
  }, [userData]);

  const handleDailyCheckIn = async () => {
    if (!currentUser || !userData || isClaimingDaily) return;
    
    const { claimable } = checkDailyClaimable();
    if (!claimable) {
      showToast("Already checked in! Please wait for the countdown.", "error");
      return;
    }

    setIsClaimingDaily(true);
    
    try {
      const reward = settings.dailyCheckInReward || 200;
      const userRef = doc(db, `${artifactRoot}/users/${currentUser.uid}/profile`, "main");
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        if (!docSnap.exists()) {
          throw new Error("User profile does not exist!");
        }

        const data = docSnap.data();
        const lastCheckIn = data?.lastCheckIn;
        if (lastCheckIn) {
          let lastCheckInMs = 0;
          if (lastCheckIn.seconds) {
            lastCheckInMs = lastCheckIn.seconds * 1000;
          } else if (lastCheckIn instanceof Date) {
            lastCheckInMs = lastCheckIn.getTime();
          } else {
            lastCheckInMs = new Date(lastCheckIn).getTime();
          }
          
          const elapsed = Date.now() - lastCheckInMs;
          if (elapsed < 24 * 60 * 60 * 1000) {
            throw new Error("Already claimed today!");
          }
        }

        const currentBal = data?.balance || 0;
        const currentTotal = data?.totalEarned || 0;
        
        transaction.update(userRef, {
          balance: currentBal + reward,
          totalEarned: currentTotal + reward,
          lastCheckIn: serverTimestamp(),
        });
      });
      
      // Log in earnings collection
      await addDoc(collection(db, `${artifactRoot}/users/${currentUser.uid}/earnings`), {
        amount: reward,
        source: "Daily Check-In Reward",
        timestamp: serverTimestamp(),
      });
      
      // Play success audio
      try {
        const audio = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-successful-payment-making-notification-2329.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}
      
      showToast(`Daily Check-In Success! +${reward} Coins.`, "success");
    } catch (err: any) {
      console.error("Daily checkin failed:", err);
      if (err?.message === "Already claimed today!") {
        showToast("Already checked in today!", "error");
      } else {
        showToast("Failed to complete Daily Check-In.", "error");
      }
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const handleVisitSponsorAd = () => {
    if (!userData || !settings.adLink) return;
    
    const { claimable } = checkAdClaimable();
    if (!claimable) {
      showToast("Sponsor reward is on cooldown!", "error");
      return;
    }

    setAdVerificationStep(1);
    setIsAdTimerRunning(false);
    setAdVerifyTimeLeft(10);
    setShowAdVerificationModal(true);
  };

  const handleStartAdStep = (step: number) => {
    if (!settings.adLink) return;
    
    // Append the simulated subpage step query parameter to the link
    const stepUrl = settings.adLink.includes("?") 
      ? `${settings.adLink}&ad_step=${step}` 
      : `${settings.adLink}?ad_step=${step}`;
      
    window.open(stepUrl, "_blank");
    
    setAdVerifyTimeLeft(10);
    setIsAdTimerRunning(true);
    showToast(`Opening Sponsor Page ${step}. Stay there for 10 seconds!`, "info");
  };

  const handleNextAdStep = () => {
    if (adVerificationStep < 3) {
      setAdVerificationStep((prev) => prev + 1);
      setIsAdTimerRunning(false);
      setAdVerifyTimeLeft(10);
    }
  };

  useEffect(() => {
    if (!showAdVerificationModal || !isAdTimerRunning) return;
    
    if (adVerifyTimeLeft <= 0) {
      setIsAdTimerRunning(false);
      try {
        const audio = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {}
      
      showToast(`Page ${adVerificationStep} verified!`, "success");
      return;
    }

    const timer = setTimeout(() => {
      setAdVerifyTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showAdVerificationModal, isAdTimerRunning, adVerifyTimeLeft, adVerificationStep]);

  const claimAdReward = async () => {
    if (!currentUser || !userData) return;
    
    try {
      const reward = settings.adReward || 150;
      const userRef = doc(db, `${artifactRoot}/users/${currentUser.uid}/profile`, "main");
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        const currentBal = docSnap.data()?.balance || 0;
        const currentTotal = docSnap.data()?.totalEarned || 0;
        
        transaction.update(userRef, {
          balance: currentBal + reward,
          totalEarned: currentTotal + reward,
          lastAdClick: serverTimestamp(),
        });
      });
      
      // Log in earnings collection
      await addDoc(collection(db, `${artifactRoot}/users/${currentUser.uid}/earnings`), {
        amount: reward,
        source: "Sponsor Ad Visit Reward",
        timestamp: serverTimestamp(),
      });
      
      // Play victory sound
      try {
        const audio = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-successful-payment-making-notification-2329.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}

      showToast(`Sponsor Reward Claimed! +${reward} Coins.`, "success");
    } catch (err) {
      console.error("Failed to claim sponsor ad reward:", err);
      showToast("Failed to claim sponsor reward.", "error");
    }
  };

  // Form states
  const [withdrawMethod, setWithdrawMethod] = useState("");
  const [withdrawDetails, setWithdrawDetails] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Simulated Withdrawal Feed (Fake sliding feed)
  const [tickerIndex, setTickerIndex] = useState(0);
  const simulatedPayments = [
    { name: "user283", amount: 20 },
    { name: "ok", amount: 50 },
    { name: "jony", amount: 10 },
    { name: "naki", amount: 100 },
    { name: "sultan", amount: 150 },
    { name: "akash", amount: 20 },
    { name: "nayan", amount: 50 },
    { name: "sakib", amount: 10 },
    { name: "Hasib", amount: 100 },
    { name: "Airdropking", amount: 50 },
  ];
  const [tickerPayments, setTickerPayments] = useState<Array<{ name: string; amount: number }>>([]);

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Visibility change check for ad click reward tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isWaitingForAdClick && pendingReward) {
        const timeSpentAway = Date.now() - adClickStartTime;
        if (timeSpentAway > 2000) {
          setIsWaitingForAdClick(false);
          setShowAdClickModal(false);
          showToast("Verification Success!", "success");
          saveGameEarnings(pendingReward.amount, "Ad Click Bonus");
          setPendingReward(null);
        } else {
          showToast("Please click the ad correctly to claim!", "error");
          setIsWaitingForAdClick(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isWaitingForAdClick, adClickStartTime, pendingReward]);

  // Rotate simulated and dynamic withdrawals
  useEffect(() => {
    const baseSimulated = [
      { name: "user283", amount: 20 },
      { name: "ok", amount: 50 },
      { name: "jony", amount: 10 },
      { name: "naki", amount: 100 },
      { name: "sultan", amount: 150 },
      { name: "akash", amount: 20 },
      { name: "nayan", amount: 50 },
      { name: "sakib", amount: 10 },
      { name: "Hasib", amount: 100 },
      { name: "Airdropking", amount: 50 },
    ];

    const realPaid = txHistory
      .filter((tx) => tx.status === "paid")
      .map((tx) => ({
        name: tx.userName || "User",
        amount: Math.floor(tx.amount / 500),
      }));

    if (realPaid.length > 0) {
      setTickerPayments([...realPaid, ...baseSimulated]);
    } else {
      const bdFirstNames = [
        "Sabbir", "Rifat", "Arif", "Fahim", "Mim", "Nisha", "Tariq", "Imran", "Sumon", 
        "Shuvo", "Roni", "Apu", "Tanvir", "Sajid", "Liton", "Hasan", "Mitu", "Rakib", 
        "Sohan", "Jihad", "Riaz", "Alamin", "Sujon", "Monir", "Rubel", "Biplob", "Shakil"
      ];
      const bdLastNames = ["Ahmed", "Hasan", "Khan", "Ali", "Islam", "Rahman", "Miah", "Sarker", "Howlader", "Talukder", "Sheikh", "Chowdhury"];
      
      const generated = Array.from({ length: 15 }).map(() => {
        const randFirst = bdFirstNames[Math.floor(Math.random() * bdFirstNames.length)];
        const useLast = Math.random() < 0.6;
        const randLast = useLast ? " " + bdLastNames[Math.floor(Math.random() * bdLastNames.length)] : "";
        const appendNum = Math.random() < 0.5 ? Math.floor(Math.random() * 999).toString() : "";
        
        const possibleAmounts = [10, 20, 50, 100, 150, 200, 250, 500];
        const randomAmount = possibleAmounts[Math.floor(Math.random() * possibleAmounts.length)];
        
        return {
          name: `${randFirst}${randLast}${appendNum}`.replace(/\s+/g, ' ').trim(),
          amount: randomAmount,
        };
      });

      setTickerPayments([...generated, ...baseSimulated]);
    }
  }, [txHistory]);

  useEffect(() => {
    const listLen = tickerPayments.length > 0 ? tickerPayments.length : 10;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % listLen);
    }, 4500);
    return () => clearInterval(interval);
  }, [tickerPayments]);

  // Firebase auth & presence
  useEffect(() => {
    let tgUser: any = null;
    let refCode: string | null = null;

    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      const initDataUnsafe = tg.initDataUnsafe || {};
      if (initDataUnsafe.start_param) {
        refCode = initDataUnsafe.start_param;
        sessionStorage.setItem("refCode", initDataUnsafe.start_param);
      }
      if (initDataUnsafe.user) {
        tgUser = initDataUnsafe.user;
      }
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRef = urlParams.get("startapp") || urlParams.get("ref");
      if (urlRef) {
        refCode = urlRef;
        sessionStorage.setItem("refCode", urlRef);
      }
    }

    const triggerAuth = async () => {
      if (tgUser) {
        setLoadingText(`Logging in as Telegram User: ${tgUser.first_name}...`);
        const email = `tg_${tgUser.id}@easyearnbd.app`;
        const password = `secret_pass_${tgUser.id}`;
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
          if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
            try {
              await createUserWithEmailAndPassword(auth, email, password);
            } catch (e) {
              await signInAnonymously(auth);
            }
          } else {
            await signInAnonymously(auth);
          }
        }
      } else {
        setLoadingText("Signing in anonymously...");
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous authentication failed:", e);
        }
      }
    };

    triggerAuth();

    let settingsUnsubscribe: (() => void) | null = null;
    let profileUnsubscribe: (() => void) | null = null;
    let earningsUnsubscribe: (() => void) | null = null;
    let withdrawalsUnsubscribe: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous listeners if auth user changes
      if (settingsUnsubscribe) { settingsUnsubscribe(); settingsUnsubscribe = null; }
      if (profileUnsubscribe) { profileUnsubscribe(); profileUnsubscribe = null; }
      if (earningsUnsubscribe) { earningsUnsubscribe(); earningsUnsubscribe = null; }
      if (withdrawalsUnsubscribe) { withdrawalsUnsubscribe(); withdrawalsUnsubscribe = null; }

      if (user) {
        setCurrentUser(user);
        setupPresence(user.uid);
        await initUserProfile(user.uid, tgUser);
        
        // Listen to settings
        settingsUnsubscribe = onSnapshot(
          doc(db, `${artifactRoot}/public/data/settings`, "global"),
          (docSnap) => {
            if (docSnap.exists()) {
              const d = docSnap.data();
              // Auto-patch settings in Firestore database if outdated
              if (
                !d.paymentMethods ||
                d.paymentMethods.includes("Paytm") ||
                d.paymentMethods.includes("UPI") ||
                Number(d.minWithdraw) < 10000
              ) {
                const settingsRef = doc(db, `${artifactRoot}/public/data/settings`, "global");
                setDoc(
                  settingsRef,
                  {
                    coinValue: "1 BDT",
                    paymentMethods: ["bKash", "Nagad", "Bank"],
                    minWithdraw: 10000,
                  },
                  { merge: true }
                ).catch((err) => console.error("Failed to patch Firestore settings:", err));
              }

              setSettings({
                coinValue: d.coinValue || "1 BDT",
                paymentMethods: d.paymentMethods || ["bKash", "Nagad", "Bank"],
                gameReward: Number(d.gameReward) || 10,
                tttReward: Number(d.tttReward) || 10,
                mathReward: Number(d.mathReward) || 10,
                referralBonus: Number(d.referralBonus) || 500,
                signupBonus: Number(d.signupBonus) || 100,
                minWithdraw: Number(d.minWithdraw) || 10000,
                adImage: d.adImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                adLink: d.adLink || "https://telegram.org",
                adReward: Number(d.adReward) || 150,
                dailyCheckInReward: Number(d.dailyCheckInReward) || 200,
                socials: d.socials || {},
              });
            } else {
              // Create default document if it doesn't exist
              const settingsRef = doc(db, `${artifactRoot}/public/data/settings`, "global");
              setDoc(settingsRef, {
                coinValue: "1 BDT",
                paymentMethods: ["bKash", "Nagad", "Bank"],
                gameReward: 10,
                tttReward: 10,
                mathReward: 10,
                referralBonus: 500,
                signupBonus: 100,
                minWithdraw: 10000,
                adImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                adLink: "https://telegram.org",
                adReward: 150,
                dailyCheckInReward: 200,
                socials: {},
              }).catch((err) => console.error("Failed to create default Firestore settings:", err));
            }
          },
          (err) => {
            console.warn("Settings snapshot listener failed:", err);
          }
        );

        // Listen to user profile snapshot
        profileUnsubscribe = onSnapshot(
          doc(db, `${artifactRoot}/users/${user.uid}/profile`, "main"),
          (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as UserProfile);
            }
          },
          (err) => {
            console.warn("Profile snapshot listener failed:", err);
          }
        );

        // Listen to earning history
        earningsUnsubscribe = onSnapshot(
          collection(db, `${artifactRoot}/users/${user.uid}/earnings`),
          (snap) => {
            const list: EarningRecord[] = [];
            snap.forEach((docSnap) => {
              list.push(docSnap.data() as EarningRecord);
            });
            list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setEarningHistory(list);
          },
          (err) => {
            console.warn("Earnings snapshot listener failed:", err);
          }
        );

        // Listen to withdrawals and refund rejected ones automatically
        withdrawalsUnsubscribe = onSnapshot(
          query(collection(db, `${artifactRoot}/public/data/withdrawals`), where("userId", "==", user.uid)),
          (snap) => {
            const list: WithdrawalRecord[] = [];
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              const rec = { id: docSnap.id, ...data } as WithdrawalRecord;
              list.push(rec);

              // Auto-Refund rejection
              if (rec.status === "rejected" && !rec.refundProcessed) {
                processRefund(rec);
              }
            });
            list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setTxHistory(list);
          },
          (err) => {
            console.warn("Withdrawals snapshot listener failed:", err);
          }
        );

        // Process referral if stored
        const storedRef = sessionStorage.getItem("refCode");
        if (storedRef) {
          setTimeout(() => {
            processReferral(storedRef, user.uid);
          }, 2000);
        }

        setLoading(false);
      }
    });

    return () => {
      if (settingsUnsubscribe) settingsUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (earningsUnsubscribe) earningsUnsubscribe();
      if (withdrawalsUnsubscribe) withdrawalsUnsubscribe();
      unsubscribeAuth();
    };
  }, []);

  // Presence system setup
  const setupPresence = (uid: string) => {
    const userStatusRef = dbRef(rtdb, `/status/${uid}`);
    const activeCountRef = dbRef(rtdb, "/status");

    onDisconnect(userStatusRef)
      .remove()
      .then(() => {
        set(userStatusRef, { state: "online", last_changed: rtdbServerTimestamp() });
      });

    onValue(activeCountRef, (snapshot) => {
      const count = snapshot.size || 0;
      setActiveUsersCount(count);
    });
  };

  // Heartbeat to update lastOnline every 2 minutes for active users
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
      try {
        const profileRef = doc(db, `${artifactRoot}/users/${currentUser.uid}/profile`, "main");
        await updateDoc(profileRef, { lastOnline: serverTimestamp() });
      } catch (e) {
        console.warn("Heartbeat update failed:", e);
      }
    }, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [currentUser]);

  // Initialize profile in Firestore
  const initUserProfile = async (uid: string, tgUser: any) => {
    const profileRef = doc(db, `${artifactRoot}/users/${uid}/profile`, "main");
    try {
      const docSnap = await getDoc(profileRef);
      if (!docSnap.exists()) {
        const code = "FAST" + Math.floor(10000 + Math.random() * 90000);
        const initialData: UserProfile = {
          uid,
          telegramId: tgUser ? tgUser.id : "anon",
          firstName: tgUser ? tgUser.first_name : "Guest User",
          balance: 0,
          referralCode: code,
          totalEarned: 0,
          totalRefers: 0,
          referredBy: null,
          photoUrl: tgUser?.photo_url || `https://ui-avatars.com/api/?name=${tgUser ? tgUser.first_name : "User"}&background=6366f1&color=fff`,
          lastOnline: serverTimestamp(),
        };
        await setDoc(profileRef, initialData);
        // Save to public referral codes registry
        await setDoc(doc(db, `${artifactRoot}/public/data/referralCodes`, code), { userId: uid });
        setUserData(initialData);
      } else {
        await updateDoc(profileRef, { lastOnline: serverTimestamp() });
        setUserData({
          ...(docSnap.data() as UserProfile),
          lastOnline: new Date()
        });
      }
    } catch (e) {
      console.error("Failed to initialize profile:", e);
    }
  };

  // Process referral code
  const processReferral = async (code: string, currentUid: string) => {
    if (!code) return;
    const cleanedCode = code.trim().toUpperCase();

    if (userData && (userData.referredBy || cleanedCode === userData.referralCode)) {
      sessionStorage.removeItem("refCode");
      return;
    }

    try {
      const refCodeSnap = await getDoc(doc(db, `${artifactRoot}/public/data/referralCodes`, cleanedCode));
      if (!refCodeSnap.exists()) {
        showToast("Invalid Referral Code", "error");
        sessionStorage.removeItem("refCode");
        return;
      }

      const referrerId = refCodeSnap.data().userId;
      if (referrerId === currentUid) {
        showToast("You cannot refer yourself!", "error");
        sessionStorage.removeItem("refCode");
        return;
      }

      // 1. Give signup reward to current user
      const currentUserRef = doc(db, `${artifactRoot}/users/${currentUid}/profile`, "main");
      await updateDoc(currentUserRef, {
        balance: (userData?.balance || 0) + settings.signupBonus,
        totalEarned: (userData?.totalEarned || 0) + settings.signupBonus,
        referredBy: cleanedCode,
      });

      // 2. Give refer reward to referrer
      const referrerRef = doc(db, `${artifactRoot}/users/${referrerId}/profile`, "main");
      const referrerDoc = await getDoc(referrerRef);
      if (referrerDoc.exists()) {
        const refData = referrerDoc.data();
        await updateDoc(referrerRef, {
          balance: (refData.balance || 0) + settings.referralBonus,
          totalEarned: (refData.totalEarned || 0) + settings.referralBonus,
          totalRefers: (refData.totalRefers || 0) + 1,
        });

        // Add earning log for referrer
        await addDoc(collection(db, `${artifactRoot}/users/${referrerId}/earnings`), {
          amount: settings.referralBonus,
          source: `Referral: ${userData?.firstName || "Friend"}`,
          timestamp: serverTimestamp(),
        });
      }

      showToast(`Applied Referral Code! +${settings.signupBonus} Coins.`, "success");
      sessionStorage.removeItem("refCode");
    } catch (e) {
      console.error("Error applying referral:", e);
    }
  };

  // Automatically process refunds for rejected requests
  const processRefund = async (record: WithdrawalRecord) => {
    if (record.refundProcessed) return;

    try {
      const withdrawalRef = doc(db, `${artifactRoot}/public/data/withdrawals`, record.id);
      const userRef = doc(db, `${artifactRoot}/users/${currentUser?.uid}/profile`, "main");

      await runTransaction(db, async (transaction) => {
        const wSnap = await transaction.get(withdrawalRef);
        if (!wSnap.exists() || wSnap.data().refundProcessed) return;

        const uSnap = await transaction.get(userRef);
        const currentBal = uSnap.data()?.balance || 0;
        const refundAmt = Number(record.amount);

        transaction.update(userRef, { balance: currentBal + refundAmt });
        transaction.update(withdrawalRef, { refundProcessed: true });
      });

      showToast(`Refund processed: +${record.amount} Coins!`, "success");

      // Log refund in user's earning history
      await addDoc(collection(db, `${artifactRoot}/users/${currentUser?.uid}/earnings`), {
        amount: Number(record.amount),
        source: `Refund for Rejected withdrawal (${record.method})`,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to process refund automatically:", e);
    }
  };

  const handleMultiAdGameWin = (amount: number, requiredAds: number, gameTitle: string) => {
    setMultiAdClaim({ amount, requiredAds, gameTitle });
  };

  const handleGameWin = (source: string) => {
    let amount = settings.gameReward;
    if (source === "Tic Tac Toe Champion") amount = settings.tttReward;
    if (source === "Math Genius") amount = settings.mathReward;

    const nextGamesCount = gamesPlayedSession + 1;
    setGamesPlayedSession(nextGamesCount);
    setPendingReward({ amount, source });

    if (nextGamesCount % 5 === 0) {
      setShowAdClickModal(true);
    } else {
      setShowClaimOverlay(true);
    }
  };

  const triggerMonetagAd = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window.show_11346256 === "function") {
        const isPopup = Math.random() < 0.5;
        if (isPopup) {
          window.show_11346256("pop")
            .then(() => resolve())
            .catch((err) => reject(err));
        } else {
          try {
            window.show_11346256({
              type: "inApp",
              inAppSettings: {
                frequency: 2,
                capping: 0.1,
                interval: 30,
                timeout: 5,
                everyPage: false
              }
            });
            setTimeout(() => resolve(), 1500);
          } catch (err) {
            reject(err);
          }
        }
      } else {
        reject(new Error("Monetag SDK not loaded"));
      }
    });
  };

  const handleWatchAd = () => {
    if (window.show_11346256) {
      showToast("Launching Sponsor Ad...", "info");
      triggerMonetagAd()
        .then(() => {
          if (pendingReward) {
            saveGameEarnings(pendingReward.amount, pendingReward.source);
            setPendingReward(null);
          }
          setShowClaimOverlay(false);
        })
        .catch((e) => {
          console.error("Ad Playback error:", e);
          // Fallback to credit points anyway to provide robust UX
          if (pendingReward) {
            saveGameEarnings(pendingReward.amount, pendingReward.source);
            setPendingReward(null);
          }
          setShowClaimOverlay(false);
        });
    } else {
      showToast("Ad sponsors loading... crediting coins anyway!", "success");
      if (pendingReward) {
        saveGameEarnings(pendingReward.amount, pendingReward.source);
        setPendingReward(null);
      }
      setShowClaimOverlay(false);
    }
  };

  const handleAdClickBonus = () => {
    setIsWaitingForAdClick(true);
    setAdClickStartTime(Date.now());

    if (window.show_11346256) {
      triggerMonetagAd()
        .then(() => {
          // If they didn't navigate or click
          if (isWaitingForAdClick) {
            setIsWaitingForAdClick(false);
            showToast("You must click the sponsor ad and spend 2+ seconds to claim!", "error");
          }
        })
        .catch((e) => {
          console.error("Ad Verification error:", e);
          // Direct claim fallback
          if (pendingReward) {
            saveGameEarnings(pendingReward.amount, "Ad Watch (Fallback)");
            setPendingReward(null);
          }
          setShowAdClickModal(false);
          setIsWaitingForAdClick(false);
        });
    } else {
      showToast("Sponsor ad verification bypassed, adding coins!", "success");
      if (pendingReward) {
        saveGameEarnings(pendingReward.amount, "Direct Bonus");
        setPendingReward(null);
      }
      setShowAdClickModal(false);
      setIsWaitingForAdClick(false);
    }
  };

  const saveGameEarnings = async (amount: number, source: string) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, `${artifactRoot}/users/${currentUser.uid}/profile`, "main");
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        const currentBal = docSnap.data()?.balance || 0;
        const currentTotal = docSnap.data()?.totalEarned || 0;
        transaction.update(userRef, {
          balance: currentBal + amount,
          totalEarned: currentTotal + amount,
        });
      });

      // Log in earnings collection
      await addDoc(collection(db, `${artifactRoot}/users/${currentUser.uid}/earnings`), {
        amount,
        source,
        timestamp: serverTimestamp(),
      });

      // Play victory sound
      try {
        const audio = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-successful-payment-making-notification-2329.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}

      showToast(`+${amount} Coins added to your wallet!`, "success");
    } catch (e) {
      console.error("Failed to credit game reward:", e);
      showToast("Network sync error, please try again", "error");
    }
  };

  const copyReferralCode = () => {
    if (!userData?.referralCode) return;
    navigator.clipboard.writeText(userData.referralCode);
    showToast("Referral Code copied!", "success");
  };

  const shareOnTelegram = () => {
    if (!userData) return;
    const botLink = `https://t.me/mushfikaassistantbot?startapp=${userData.referralCode}`;
    const text = `Join EasyEarnBD & get ${settings.signupBonus} Coins Bonus! 🚀\nPlay Games & Earn Real Money.\n\n👇 Click here to start earning now:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleApplyManualReferral = () => {
    const codeInput = (document.getElementById("manual-ref-input") as HTMLInputElement)?.value;
    if (!codeInput) {
      showToast("Please enter a code!", "error");
      return;
    }
    processReferral(codeInput, currentUser?.uid || "");
  };

  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawMethod) {
      showToast("Select a payment method first!", "error");
      return;
    }
    const amount = parseInt(withdrawAmount);
    if (isNaN(amount) || amount < settings.minWithdraw) {
      showToast(`Minimum withdrawal is ${settings.minWithdraw} coins`, "error");
      return;
    }
    if (!userData || amount > userData.balance) {
      showToast("Insufficient coin balance!", "error");
      return;
    }

    const details = withdrawDetails.trim();
    if (!details) {
      showToast("Payment details cannot be empty!", "error");
      return;
    }

    // Advanced Regex validations
    const methodLower = withdrawMethod.toLowerCase();
    if (methodLower.includes("bkash") || methodLower.includes("nagad")) {
      if (!/^\d{11}$/.test(details)) {
        showToast("Enter a valid 11-digit mobile number (e.g. 017XXXXXXXX)", "error");
        return;
      }
    } else if (methodLower.includes("bank")) {
      if (details.length < 12) {
        showToast("Enter complete details (Bank Name, Acc Number, Branch, routing etc.)", "error");
        return;
      }
    }

    try {
      const userRef = doc(db, `${artifactRoot}/users/${currentUser?.uid}/profile`, "main");
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        const currentBal = docSnap.data()?.balance || 0;
        transaction.update(userRef, { balance: currentBal - amount });
      });

      // Add to public pending withdrawals pool
      await addDoc(collection(db, `${artifactRoot}/public/data/withdrawals`), {
        userId: currentUser?.uid,
        userName: userData.firstName || "Guest",
        amount,
        method: withdrawMethod,
        details,
        status: "pending",
        refundProcessed: false,
        timestamp: serverTimestamp(),
      });

      setShowSuccessModal(true);
      setWithdrawAmount("");
      setWithdrawDetails("");
      
      // Auto close success modal after 5 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 5000);
    } catch (e) {
      console.error("Failed to process withdrawal request:", e);
      showToast("Failed to submit request. Try again.", "error");
    }
  };

  const getDetailsPlaceholder = () => {
    const method = withdrawMethod.toLowerCase();
    if (method.includes("bkash")) return "Enter bKash Personal Number (11-digit)";
    if (method.includes("nagad")) return "Enter Nagad Personal Number (11-digit)";
    if (method.includes("bank")) return "Enter Bank Name, Account Number, Branch & Routing Info";
    return "Enter withdrawal details";
  };

  if (loading) {
    return (
      <div id="auth-screen" className="fixed inset-0 z-50 bg-[#02040a] flex flex-col items-center justify-center p-6 text-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full opacity-20 blur-md animate-pulse"></div>
          <div className="absolute inset-2 bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
            <Gift className="w-14 h-14 text-white animate-bounce" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 mb-2 tracking-tight">
          EasyEarnBD
        </h1>
        <p className="text-slate-400 mb-8 text-sm font-medium">Play Games & Earn Real Money Instantly!</p>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-t-transparent border-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-xs text-slate-500 font-mono tracking-wider uppercase">{loadingText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#02040a] text-slate-100 selection:bg-emerald-500/30">
      {/* Toast Alert Box */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="flex justify-between items-center p-4 pt-6 bg-gradient-to-b from-[#02040a] via-[#02040a]/80 to-transparent z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-[2px] shadow-lg shadow-emerald-500/10">
            <img
              id="user-avatar"
              src={userData?.photoUrl || "https://ui-avatars.com/api/?name=User&background=random"}
              className="w-full h-full rounded-full object-cover border-2 border-[#02040a]"
              alt="Avatar"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight text-white flex items-center gap-1">
              {userData?.firstName || "Guest"}
            </h2>
            <span className="text-[10px] text-slate-400">Welcome back to EasyEarnBD!</span>
          </div>
        </div>

        {/* Right Balance Box */}
        <div className="flex flex-col items-end gap-1">
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/10">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-bold text-white text-xs">{userData?.balance || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-0.5 rounded-full border border-white/5 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] text-slate-300 font-mono font-bold">
              {activeUsersCount} Online
            </span>
          </div>
        </div>
      </header>

      {/* Scrollable Main Area */}
      <main className="flex-1 overflow-y-auto custom-scroll p-4 pb-28 relative">
        <AnimatePresence mode="wait">
          {activePage === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Fake withdrawing payment slider */}
              <div className="glass-card rounded-2xl mb-4 border border-yellow-500/10 bg-yellow-500/5 relative overflow-hidden h-11 flex items-center justify-center">
                <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#02040a] to-transparent z-10"></div>
                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#02040a] to-transparent z-10"></div>
 
                <AnimatePresence mode="wait">
                  {tickerPayments.length > 0 && (
                    <motion.div
                      key={tickerIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                      className="flex items-center gap-2"
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${tickerPayments[tickerIndex % tickerPayments.length].name}&background=random`}
                        className="w-5 h-5 rounded-full"
                        alt="User icon"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        {tickerPayments[tickerIndex % tickerPayments.length].name} withdrew{" "}
                        <span className="text-emerald-400 font-bold">৳{tickerPayments[tickerIndex % tickerPayments.length].amount}</span>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
 
              {/* Daily Tasks / Rewards Quick Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Check-In */}
                <div className="relative overflow-hidden bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-emerald-500/20 transition group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                        📆
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">Daily Check-In</h4>
                        <p className="text-[10px] text-slate-400">Claim free coins every 24 hours</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-black">
                      +{settings.dailyCheckInReward || 200}
                    </span>
                  </div>

                  {canClaimDaily ? (
                    <button
                      onClick={handleDailyCheckIn}
                      disabled={isClaimingDaily}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold py-3 rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all text-xs"
                    >
                      {isClaimingDaily ? "CLAIMING..." : "CLAIM DAILY REWARD"}
                    </button>
                  ) : (
                    <div className="w-full bg-slate-800/40 border border-slate-800 text-center py-3 rounded-2xl font-mono text-xs text-slate-400 font-extrabold">
                      NEXT CLAIM IN: {dailyCountdown}
                    </div>
                  )}
                </div>

                {/* Direct Link Sponsor Ad Card */}
                {settings.adImage && settings.adLink && (
                  <div className="relative overflow-hidden bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-indigo-500/20 transition group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl"></div>
                    
                    {/* Highly Visible Sponsor Banner Image */}
                    <div className="w-full h-32 rounded-2xl overflow-hidden border border-slate-800/80 mb-4 relative shadow-inner bg-slate-950 shrink-0">
                      <img
                        src={settings.adImage}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        alt="Sponsor Promotion"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-indigo-600/95 backdrop-blur-sm px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-lg border border-indigo-400/20">
                        Sponsor Ad
                      </div>
                      <div className="absolute top-2.5 right-2.5 bg-slate-950/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[9px] font-black text-indigo-400 border border-indigo-500/30 shadow">
                        +{settings.adReward || 150} Coins
                      </div>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5 truncate">
                          <span>Sponsor Offer</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Visit all 3 sponsor sub-pages for 10s each to claim</p>
                      </div>
                    </div>

                    {canClaimAd ? (
                      <button
                        onClick={handleVisitSponsorAd}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold py-3 rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all text-xs"
                      >
                        VISIT SPONSOR & CLAIM
                      </button>
                    ) : (
                      <div className="w-full bg-slate-800/40 border border-slate-800 text-center py-3 rounded-2xl font-mono text-xs text-slate-400 font-extrabold">
                        NEXT CLAIM IN: {adCountdown}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Featured Game Banners */}
              <div className="space-y-4">
                {/* Big Hero Lucky Spin Wheel Banner */}
                <div
                  onClick={() => setActiveGame("lucky-wheel")}
                  className="relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer shadow-lg shadow-emerald-950/10 group border border-white/5 active:scale-[0.98] transition-transform duration-200 neon-glow-emerald"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 transition duration-500 group-hover:scale-105"></div>
                  <div className="absolute inset-0 p-6 flex flex-col justify-center items-start z-10">
                    <span className="bg-white/20 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1 rounded mb-2 border border-white/10 flex items-center gap-1 uppercase tracking-wider animate-pulse">
                      <Gift className="w-3 h-3 text-yellow-300 fill-yellow-300" /> BRAND NEW
                    </span>
                    <h2 className="text-2xl font-black text-white leading-tight mb-0.5">
                      Lucky Spin Wheel
                    </h2>
                    <p className="text-emerald-100 text-[11px] mb-4 opacity-90 font-medium max-w-[210px]">
                      Spin the lucky wheel & win high-value rewards instantly!
                    </p>
                    <button className="bg-white text-emerald-600 text-[11px] font-black px-4.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-emerald-50 transition duration-200">
                      <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" /> SPIN NOW
                    </button>
                  </div>
                  <div className="absolute right-3 bottom-3 pointer-events-none">
                    <Coins className="w-16 h-16 text-yellow-300 fill-yellow-300 opacity-90 animate-bounce drop-shadow-md" />
                  </div>
                </div>

                {/* Big Hero Image Finder Banner */}
                <div
                  onClick={() => setActiveGame("image-finder")}
                  className="relative w-full h-44 rounded-3xl overflow-hidden cursor-pointer shadow-lg shadow-cyan-950/10 group border border-white/5 active:scale-[0.98] transition-transform duration-200 neon-glow-indigo"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 transition duration-500 group-hover:scale-105"></div>
                  <div className="absolute inset-0 p-6 flex flex-col justify-center items-start z-10">
                    <span className="bg-white/15 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded mb-1.5 border border-white/10 flex items-center gap-1 uppercase tracking-wider">
                      <Flame className="w-3 h-3 text-orange-400 fill-orange-400" /> POPULAR
                    </span>
                    <h2 className="text-xl font-black text-white leading-tight mb-0.5">
                      Image Finder
                    </h2>
                    <p className="text-cyan-100 text-[11px] mb-3 opacity-90 font-medium">
                      Find 3 correct images under 30 seconds to win coins!
                    </p>
                    <button className="bg-white text-cyan-600 text-[11px] font-black px-4 py-1.5 rounded-full shadow-md flex items-center gap-1.5 hover:bg-cyan-50 transition duration-200">
                      <Play className="w-3 h-3 fill-cyan-600 text-cyan-600" /> PLAY GAME
                    </button>
                  </div>
                  <div className="absolute right-4 bottom-4 pointer-events-none">
                    <Search className="w-14 h-14 text-white opacity-10 rotate-12" />
                  </div>
                </div>
              </div>

              {/* Games Category Grid */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-300 flex items-center gap-2 mb-4 px-1 uppercase tracking-wider">
                  <Shapes className="w-4 h-4 text-emerald-400" /> Additional Games
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {/* Tic Tac Toe */}
                  <div
                    onClick={() => setActiveGame("ttt")}
                    className="glass-card p-3 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:border-emerald-500/20 active:scale-[0.98] transition-all duration-200 group neon-glow-emerald"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                      ❌
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">
                        Tic Tac Toe
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Beat Smart AI • Earn {settings.tttReward} Coins
                      </p>
                    </div>
                    <button className="bg-slate-900/80 border border-slate-800 hover:bg-emerald-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md text-white active:scale-90">
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  </div>

                  {/* Math Solve */}
                  <div
                    onClick={() => setActiveGame("math")}
                    className="glass-card p-3 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:border-pink-500/20 active:scale-[0.98] transition-all duration-200 group neon-glow-pink"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                      ➕
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-pink-400 transition">
                        Math Solve
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Solve simple sums • Earn {settings.mathReward} Coins
                      </p>
                    </div>
                    <button className="bg-slate-900/80 border border-slate-800 hover:bg-pink-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md text-white active:scale-90">
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  </div>

                  {/* Memory Cards */}
                  <div
                    onClick={() => setActiveGame("memory-match")}
                    className="glass-card p-3 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:border-teal-500/20 active:scale-[0.98] transition-all duration-200 group neon-glow-emerald"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                      🧠
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-teal-400 transition">
                        Memory Cards
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Match fruit pairs • Earn 20 Coins (2 Ads Claim)
                      </p>
                    </div>
                    <button className="bg-slate-900/80 border border-slate-800 hover:bg-teal-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md text-white active:scale-90">
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  </div>

                  {/* Golden Tap Miner */}
                  <div
                    onClick={() => setActiveGame("coin-clicker")}
                    className="glass-card p-3 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:border-yellow-500/20 active:scale-[0.98] transition-all duration-200 group neon-glow-pink"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                      ⚡
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-yellow-400 transition">
                        Golden Tap Miner
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Tap ultra fast • Earn 20 Coins (2 Ads Claim)
                      </p>
                    </div>
                    <button className="bg-slate-900/80 border border-slate-800 hover:bg-yellow-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md text-white active:scale-90">
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  </div>

                  {/* Stroop Reflex */}
                  <div
                    onClick={() => setActiveGame("color-match")}
                    className="glass-card p-3 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:border-purple-500/20 active:scale-[0.98] transition-all duration-200 group neon-glow-indigo"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                      🎨
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-purple-400 transition">
                        Stroop Reflex
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Color-word matching • Earn 20 Coins (2 Ads Claim)
                      </p>
                    </div>
                    <button className="bg-slate-900/80 border border-slate-800 hover:bg-purple-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-md text-white active:scale-90">
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Social Join Community Section */}
              {settings.socials && (settings.socials.telegram || settings.socials.youtube || settings.socials.instagram) && (
                <div id="social-container" className="mt-8">
                  <h3 className="font-bold text-sm text-white mb-3 px-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> Join Official Community
                  </h3>
                  <div className="flex justify-center gap-6 glass-card p-4 rounded-2xl">
                    {settings.socials.telegram && (
                      <a
                        href={settings.socials.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 bg-[#229ED9] rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition hover:bg-white hover:text-[#229ED9]"
                      >
                        <Send className="w-5 h-5 fill-white text-[#229ED9]" />
                      </a>
                    )}
                    {settings.socials.youtube && (
                      <a
                        href={settings.socials.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 bg-[#FF0000] rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition hover:bg-white hover:text-[#FF0000]"
                      >
                        <Youtube className="w-5 h-5 fill-white" />
                      </a>
                    )}
                    {settings.socials.instagram && (
                      <a
                        href={settings.socials.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 bg-gradient-to-tr from-[#FFDC80] via-[#FD1D1D] to-[#833AB4] rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition hover:opacity-85"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activePage === "refer" && (
            <motion.div
              key="refer"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center mt-2 space-y-6"
            >
              <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-3xl flex items-center justify-center mb-2 shadow-xl shadow-emerald-900/30 rotate-3 border-4 border-[#02040a]">
                <Gift className="w-12 h-12 text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white">Invite & Earn</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Earn <span className="text-yellow-400 font-extrabold">{settings.referralBonus} Coins</span> per referral friend!
                </p>
              </div>

              {/* Stat card */}
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60 w-full max-w-[200px] shadow-md">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Total Referral Friends</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-1">{userData?.totalRefers || 0}</p>
              </div>

              {/* Code box */}
              <div className="w-full glass-card p-5 rounded-2xl border border-dashed border-slate-600 mb-2 relative overflow-hidden group">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold mb-2.5">
                  Your Invite Code
                </p>
                <div className="flex items-center justify-between bg-black/20 px-4 py-3 rounded-xl border border-white/5">
                  <span className="text-2xl font-mono font-extrabold text-white tracking-widest">
                    {userData?.referralCode || "LOADING..."}
                  </span>
                  <button
                    onClick={copyReferralCode}
                    className="w-9 h-9 bg-slate-800 hover:bg-white hover:text-black rounded-xl flex items-center justify-center transition active:scale-90"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Telegram Invite Button */}
              <button
                onClick={shareOnTelegram}
                className="w-full bg-[#229ED9] hover:bg-[#1e8abc] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-sky-900/20 active:scale-95 transition"
              >
                <Send className="w-5 h-5 fill-white text-[#229ED9] rotate-45" />
                <span>Invite on Telegram</span>
              </button>

              {/* Manual Input form */}
              <div className="w-full glass-card p-4.5 rounded-2xl text-left">
                <p className="text-xs text-emerald-300 mb-2 font-bold uppercase tracking-wider">
                  Enter Referral Code
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="manual-ref-input"
                    placeholder="ENTER CODE"
                    className="bg-[#080d1a] flex-1 rounded-xl px-4 py-3 text-sm text-white border border-slate-700 outline-none uppercase font-mono font-bold tracking-widest focus:border-emerald-500 transition"
                  />
                  <button
                    onClick={handleApplyManualReferral}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 rounded-xl font-bold text-sm active:scale-95 transition shadow-lg shadow-emerald-900/20"
                  >
                    APPLY
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activePage === "wallet" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-extrabold px-1">My Wallet</h2>

              {/* Elegant bank-like card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-center border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 opacity-10 rounded-full blur-xl pointer-events-none"></div>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Current Balance</p>
                <h1 className="text-5xl font-extrabold text-white my-3 flex justify-center items-center gap-2 tracking-tight">
                  <span>{userData?.balance || 0}</span>
                  <Coins className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                </h1>
                <div className="inline-block bg-slate-800/80 backdrop-blur border border-white/10 px-4 py-1.5 rounded-full text-xs text-slate-300 font-medium">
                  Rate: 500 Coins = <span className="text-emerald-400 font-extrabold">{settings.coinValue}</span>
                </div>
              </div>

              {/* Redeeming option */}
              <div className="glass-card rounded-2xl p-5 border border-slate-700/50">
                <h3 className="font-extrabold text-sm text-emerald-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" /> Withdraw Money
                </h3>
                <form onSubmit={handleWithdrawRequest} className="space-y-4">
                  <div className="relative">
                    <select
                      id="withdraw-method"
                      value={withdrawMethod}
                      onChange={(e) => {
                        setWithdrawMethod(e.target.value);
                        setWithdrawDetails("");
                      }}
                      className="w-full bg-[#080d1a] border border-slate-700 rounded-xl p-3.5 text-sm text-white appearance-none outline-none focus:border-emerald-500 transition font-bold"
                    >
                      <option value="" disabled>
                        Select Withdrawal Method
                      </option>
                      {settings.paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-4 top-4 text-slate-400" />
                  </div>

                  <input
                    type="text"
                    value={withdrawDetails}
                    onChange={(e) => setWithdrawDetails(e.target.value)}
                    required
                    placeholder={withdrawMethod ? getDetailsPlaceholder() : "Select Method First"}
                    disabled={!withdrawMethod}
                    className="w-full bg-[#080d1a] border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-emerald-500 transition placeholder-slate-600 disabled:opacity-50"
                  />

                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    placeholder={`Amount (Min ${settings.minWithdraw} Coins)`}
                    className="w-full bg-[#080d1a] border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-emerald-500 transition placeholder-slate-600 font-semibold"
                  />

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-950/20 active:scale-95 transition"
                  >
                    Redeem Now
                  </button>
                </form>
              </div>

              {/* Transactions History */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-300 uppercase tracking-widest px-1 mb-3">
                  Withdrawal History
                </h3>
                <div className="space-y-2.5">
                  {txHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                      No transactions recorded yet.
                    </div>
                  ) : (
                    txHistory.slice(0, 15).map((tx) => (
                      <div key={tx.id} className="glass-card p-3 rounded-2xl flex justify-between items-center border border-white/5 shadow-sm">
                        <div>
                          <p className="font-bold text-sm text-white">{tx.method}</p>
                          <p className="text-[10px] text-slate-400 font-medium font-mono">{tx.details}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-white text-sm">-{tx.amount} Coins</p>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-widest ${
                              tx.status === "paid"
                                ? "text-emerald-400"
                                : tx.status === "rejected"
                                ? "text-rose-400"
                                : "text-yellow-400"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activePage === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-extrabold px-1">My Profile</h2>

              <div className="glass-card rounded-2xl p-6 text-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/15 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto rounded-full p-[2px] bg-gradient-to-tr from-emerald-500 to-teal-500 mb-3 shadow-lg shadow-emerald-500/10">
                    <img
                      src={userData?.photoUrl || "https://ui-avatars.com/api/?name=User&background=random"}
                      className="w-full h-full rounded-full object-cover bg-slate-900 border-2 border-[#02040a]"
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">{userData?.firstName || "Guest"}</h3>
                  <p className="text-slate-400 text-xs font-semibold">Verified EasyEarnBD Member</p>

                  <div className="mt-6 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60 shadow-sm">
                    <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1">
                      Total Lifetime Earnings
                    </p>
                    <p className="text-2xl font-black text-emerald-400 flex justify-center items-center gap-1.5">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span>{userData?.totalEarned || 0} Coins</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Earnings Log list */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-300 uppercase tracking-widest px-1 mb-3">
                  Earning Events History
                </h3>
                <div className="space-y-2.5">
                  {earningHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                      No earning activities yet.
                    </div>
                  ) : (
                    earningHistory.slice(0, 10).map((record, index) => (
                      <div
                        key={index}
                        className="glass-card p-3.5 rounded-2xl flex justify-between items-center border-l-4 border-l-emerald-500 shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-sm text-white">{record.source}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Credit Completed
                          </p>
                        </div>
                        <p className="font-extrabold text-emerald-400 text-sm">+{record.amount}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Admin Portal Entry Option */}
              <div className="mt-8 pt-6 border-t border-slate-800/80">
                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3.5 shadow-sm">
                  <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Staff Admin Dashboard</h4>
                    <p className="text-[10px] text-slate-500 max-w-[240px] mx-auto mt-1 leading-normal font-medium">
                      Control system members, adjust coin rewards, ban/delete accounts, and manage withdrawal queues.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminPanel(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-extrabold text-xs py-3 rounded-xl transition active:scale-95 border border-slate-700/60"
                  >
                    Enter Admin Portal
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav Bar */}
      <nav className="glass-nav fixed bottom-0 left-0 right-0 pb-safe pt-2 px-6 flex justify-between items-center z-40 h-[75px]">
        <button
          onClick={() => setActivePage("home")}
          className={`flex flex-col items-center gap-1 w-14 transition duration-300 ${
            activePage === "home" ? "text-emerald-400 font-black scale-105" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activePage === "home" ? "bg-emerald-500/10 text-emerald-400" : ""}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight font-semibold">Home</span>
        </button>

        <button
          onClick={() => setActivePage("refer")}
          className={`flex flex-col items-center gap-1 w-14 transition duration-300 ${
            activePage === "refer" ? "text-emerald-400 font-black scale-105" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activePage === "refer" ? "bg-emerald-500/10 text-emerald-400" : ""}`}>
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight font-semibold">Refer</span>
        </button>

        {/* Big Game Button */}
        <div className="relative -top-6">
          <button
            onClick={() => setActiveGame("lucky-wheel")}
            className="w-16 h-16 bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 border-4 border-[#02040a] active:scale-90 hover:scale-105 transition duration-200 group animate-pulse"
          >
            <Gift className="w-7 h-7 text-white group-hover:scale-110 transition" />
          </button>
        </div>

        <button
          onClick={() => setActivePage("wallet")}
          className={`flex flex-col items-center gap-1 w-14 transition duration-300 ${
            activePage === "wallet" ? "text-emerald-400 font-black scale-105" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activePage === "wallet" ? "bg-emerald-500/10 text-emerald-400" : ""}`}>
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight font-semibold">Wallet</span>
        </button>

        <button
          onClick={() => setActivePage("profile")}
          className={`flex flex-col items-center gap-1 w-14 transition duration-300 ${
            activePage === "profile" ? "text-emerald-400 font-black scale-105" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activePage === "profile" ? "bg-emerald-500/10 text-emerald-400" : ""}`}>
            <UserIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight font-semibold">Profile</span>
        </button>
      </nav>

      {/* --- ALL GAME MODALS --- */}
      <AnimatePresence>
        {activeGame === "image-finder" && (
          <ImageFinder
            onClose={() => setActiveGame(null)}
            onWin={() => handleGameWin("Image Finder Master")}
            onShowToast={showToast}
          />
        )}

        {activeGame === "ttt" && (
          <TicTacToe
            onClose={() => setActiveGame(null)}
            onWin={() => handleGameWin("Tic Tac Toe Champion")}
            onShowToast={showToast}
            rewardAmount={settings.tttReward}
          />
        )}

        {activeGame === "math" && (
          <MathSolve
            onClose={() => setActiveGame(null)}
            onWin={() => handleGameWin("Math Genius")}
            onShowToast={showToast}
            rewardAmount={settings.mathReward}
          />
        )}

        {activeGame === "lucky-wheel" && (
          <LuckyWheel
            onClose={() => setActiveGame(null)}
            onWin={(amount) => handleMultiAdGameWin(amount, 3, "Lucky Spin Wheel")}
            onShowToast={showToast}
          />
        )}

        {activeGame === "memory-match" && (
          <MemoryMatch
            onClose={() => setActiveGame(null)}
            onWin={() => handleMultiAdGameWin(20, 2, "Memory Cards")}
            onShowToast={showToast}
            rewardAmount={20}
          />
        )}

        {activeGame === "coin-clicker" && (
          <CoinClicker
            onClose={() => setActiveGame(null)}
            onWin={() => handleMultiAdGameWin(20, 2, "Golden Tap Miner")}
            onShowToast={showToast}
            rewardAmount={20}
          />
        )}

        {activeGame === "color-match" && (
          <ColorMatch
            onClose={() => setActiveGame(null)}
            onWin={() => handleMultiAdGameWin(20, 2, "Stroop Reflex")}
            onShowToast={showToast}
            rewardAmount={20}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {multiAdClaim && (
          <MultiAdClaim
            rewardAmount={multiAdClaim.amount}
            requiredAds={multiAdClaim.requiredAds}
            gameTitle={multiAdClaim.gameTitle}
            onCancel={() => setMultiAdClaim(null)}
            onClaimComplete={(amount) => {
              saveGameEarnings(amount, multiAdClaim.gameTitle);
              setMultiAdClaim(null);
            }}
            onShowToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* --- CLAIMS OVERLAYS --- */}
      {/* 1. Watch Ad Claim Reward Overlay */}
      <AnimatePresence>
        {showClaimOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="mb-6 text-7xl animate-bounce">🎁</div>
            <h2 className="text-3xl font-extrabold text-white mb-2">You Won!</h2>
            <p className="text-slate-300 mb-8 text-lg font-medium">Watch Ad to Claim Reward</p>
            <button
              onClick={handleWatchAd}
              className="w-full max-w-xs bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-orange-500/30 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-5 h-5" />
              <span>CLAIM REWARD</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Ad click modal verification */}
      <AnimatePresence>
        {showAdClickModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl"
          >
            <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-lg shadow-indigo-500/50">
              <MousePointer className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 leading-snug">Click Ad to Claim Coin</h2>
            <p className="text-amber-300 text-sm font-extrabold max-w-xs tracking-wide">
              Sponsor ad par click kare tabhi coins claim ho payenge!
            </p>
            <button
              onClick={handleAdClickBonus}
              className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-500/40 active:scale-95 transition w-full max-w-xs flex items-center justify-center gap-3"
            >
              <PlayCircle className="w-5 h-5" />
              <span>WATCH SPONSOR AD</span>
            </button>
            <p className="text-xs text-slate-500 mt-4 max-w-[200px]">
              Ad click karke web page par 2+ seconds spend karein, fir back aayein.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Successful withdrawal submission modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 p-8 rounded-3xl border border-emerald-500/30 shadow-2xl flex flex-col items-center max-w-sm w-full relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none"></div>
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/40">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Success!</h2>
              <p className="text-slate-300 text-sm mb-6">Payment request submitted successfully.</p>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 w-full mb-6">
                <p className="text-xs text-slate-400 mb-1 uppercase font-black tracking-widest">
                  Estimated Arrival
                </p>
                <p className="text-yellow-400 font-extrabold text-lg flex items-center justify-center gap-1.5">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span>24 - 48 Hours</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-4 rounded-xl shadow-lg active:scale-95 transition"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sponsor Ad Verification Countdown Modal */}
      <AnimatePresence>
        {showAdVerificationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-indigo-500/30 p-8 rounded-3xl max-w-sm w-full relative overflow-hidden shadow-2xl shadow-indigo-500/10"
            >
              <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none"></div>
              
              {/* Step indicator bubbles */}
              <div className="flex justify-center items-center gap-3 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition duration-300 ${
                        adVerificationStep === step
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-2 border-indigo-400"
                          : adVerificationStep > step
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-800 text-slate-500 border border-slate-700"
                      }`}
                    >
                      {adVerificationStep > step ? "✓" : step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`w-8 h-0.5 mx-1 ${
                          adVerificationStep > step ? "bg-emerald-500" : "bg-slate-800"
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-black text-white mb-1 leading-tight">
                Sponsor Offer Verification
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                Step {adVerificationStep} of 3: Complete all 3 sponsor sub-pages
              </p>

              {/* Central state area */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 mb-6">
                {isAdTimerRunning ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/40 rounded-full flex items-center justify-center mb-3 mx-auto animate-pulse">
                      <div className="text-2xl font-black text-indigo-400 font-mono">
                        {adVerifyTimeLeft}s
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-wider animate-pulse">
                        Viewing Sponsor Sub-Page...
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Please keep the sponsor tab open in your browser. Timer will resume/finish here shortly.
                      </p>
                    </div>
                  </div>
                ) : adVerifyTimeLeft === 0 ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Page {adVerificationStep} Verified!
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        You successfully completed the step. Press continue.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <span className="text-2xl text-slate-400">🔗</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">
                        Ready for Step {adVerificationStep}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Click below to open the official sponsor offer sub-page.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {isAdTimerRunning ? (
                  <div className="w-full bg-slate-800/40 border border-slate-800 text-center py-3.5 rounded-xl font-mono text-[10px] text-slate-500 font-black tracking-widest animate-pulse">
                    DO NOT CLOSE SPONSOR TAB
                  </div>
                ) : adVerifyTimeLeft === 0 ? (
                  adVerificationStep < 3 ? (
                    <button
                      onClick={handleNextAdStep}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-black py-3.5 rounded-xl text-xs tracking-wider shadow-lg shadow-indigo-500/20 active:scale-95 transition"
                    >
                      PROCEED TO NEXT PAGE
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowAdVerificationModal(false);
                        claimAdReward();
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-3.5 rounded-xl text-xs tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition"
                    >
                      🎉 CLAIM YOUR {settings.adReward || 150} COINS
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleStartAdStep(adVerificationStep)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl text-xs tracking-wider shadow-lg active:scale-95 transition"
                  >
                    🚀 VISIT SPONSOR PAGE {adVerificationStep}
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowAdVerificationModal(false);
                    setIsAdTimerRunning(false);
                    showToast("Verification aborted! You must visit all 3 sponsor pages for 10 seconds each to claim the reward.", "error");
                  }}
                  className="w-full text-[10px] font-bold text-rose-400/80 hover:text-rose-400 uppercase tracking-widest py-2 active:scale-95 transition"
                >
                  Cancel & Abort Progress
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminPanel && (
          <AdminDashboard
            onClose={() => setShowAdminPanel(false)}
            onShowToast={showToast}
            currentSettings={settings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
