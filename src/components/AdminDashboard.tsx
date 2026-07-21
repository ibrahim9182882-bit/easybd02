import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Users,
  CheckCircle,
  XCircle,
  Settings,
  Coins,
  Ban,
  Trash2,
  Plus,
  Minus,
  Gift,
  Search,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Check,
  X,
  AlertTriangle
} from "lucide-react";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { UserProfile, GlobalSettings, EarningRecord, WithdrawalRecord } from "../types";

interface AdminDashboardProps {
  onClose: () => void;
  onShowToast: (text: string, type?: "success" | "error" | "info") => void;
  currentSettings: GlobalSettings;
}

export default function AdminDashboard({ onClose, onShowToast, currentSettings }: AdminDashboardProps) {
  // Authentication status
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Stats & States
  const [activeTab, setActiveTab] = useState<"stats" | "members" | "withdrawals" | "settings">("stats");
  const [loadingData, setLoadingData] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [settingsForm, setSettingsForm] = useState<GlobalSettings>({ ...currentSettings });

  // Filter & Search states
  const [memberSearch, setMemberSearch] = useState("");
  const [withdrawalFilter, setWithdrawalFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");

  // Selection for operations
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState<number | "">("");
  const [giftReason, setGiftReason] = useState("");
  const [customPayMethod, setCustomPayMethod] = useState("");

  const artifactRoot = "artifacts/easybd-2fc02";

  // Check if current authenticated user is already admin
  useEffect(() => {
    const checkCurrentAuth = () => {
      if (auth.currentUser?.email === "ibrahim9182882@gmail.com") {
        setIsAdminAuth(true);
        fetchData();
      }
    };
    checkCurrentAuth();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminEmail !== "ibrahim9182882@gmail.com") {
      onShowToast("Access Denied: Not the Admin email", "error");
      return;
    }
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setIsAdminAuth(true);
      onShowToast("Welcome, Administrator!", "success");
      fetchData();
    } catch (err: any) {
      onShowToast(err.message || "Failed to log in as Admin", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch Users using collectionGroup query
      const userList: UserProfile[] = [];
      const querySnapshot = await getDocs(query(collectionGroup(db, "profile")));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        userList.push({
          uid: docSnap.ref.parent.parent?.id || data.uid,
          ...data
        } as UserProfile);
      });
      setMembers(userList);

      // 2. Fetch withdrawals
      const withdrawList: WithdrawalRecord[] = [];
      const wSnap = await getDocs(collection(db, `${artifactRoot}/public/data/withdrawals`));
      wSnap.forEach((docSnap) => {
        withdrawList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as WithdrawalRecord);
      });
      withdrawList.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setWithdrawals(withdrawList);

      // 3. Fetch Settings
      const settingsSnap = await getDoc(doc(db, `${artifactRoot}/public/data/settings`, "global"));
      if (settingsSnap.exists()) {
        setSettingsForm(settingsSnap.data() as GlobalSettings);
      }
    } catch (err: any) {
      console.error("Error fetching admin data:", err);
      onShowToast("Permissions or Network issue while fetching admin data.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  // User Actions
  const handleToggleUserStatus = async (user: UserProfile) => {
    const isCurrentlyBanned = (user as any).disabled === true;
    const updatedStatus = !isCurrentlyBanned;
    try {
      const userRef = doc(db, `${artifactRoot}/users/${user.uid}/profile`, "main");
      await updateDoc(userRef, { disabled: updatedStatus });
      onShowToast(`User has been ${updatedStatus ? "Disabled" : "Enabled"}`, "success");
      setMembers((prev) =>
        prev.map((m) => (m.uid === user.uid ? { ...m, disabled: updatedStatus } : m))
      );
      if (selectedUser?.uid === user.uid) {
        setSelectedUser({ ...selectedUser, disabled: updatedStatus } as any);
      }
    } catch (err: any) {
      onShowToast("Failed to update user status: " + err.message, "error");
    }
  };

  const handleDeleteUserDoc = async (user: UserProfile) => {
    if (!window.confirm(`Are you absolutely sure you want to delete profile data for ${user.firstName}?`)) {
      return;
    }
    try {
      const userRef = doc(db, `${artifactRoot}/users/${user.uid}/profile`, "main");
      await deleteDoc(userRef);
      onShowToast("User Profile document deleted", "success");
      setMembers((prev) => prev.filter((m) => m.uid !== user.uid));
      setSelectedUser(null);
    } catch (err: any) {
      onShowToast("Failed to delete user profile: " + err.message, "error");
    }
  };

  const handleAdjustBalance = async (type: "add" | "deduct" | "gift") => {
    if (!selectedUser || !balanceAdjustAmount || Number(balanceAdjustAmount) <= 0) {
      onShowToast("Please enter a valid amount", "error");
      return;
    }
    const amt = Math.floor(Number(balanceAdjustAmount));
    const currentBalance = selectedUser.balance || 0;
    const currentTotal = selectedUser.totalEarned || 0;

    let newBalance = currentBalance;
    let newTotal = currentTotal;

    if (type === "add" || type === "gift") {
      newBalance += amt;
      newTotal += amt;
    } else {
      newBalance = Math.max(0, currentBalance - amt);
    }

    try {
      const userRef = doc(db, `${artifactRoot}/users/${selectedUser.uid}/profile`, "main");
      await updateDoc(userRef, {
        balance: newBalance,
        totalEarned: newTotal
      });

      // Add Earning Event Log
      const eventSource = type === "gift" ? (giftReason || "Special Admin Gift") : `Admin Manual Adjust (${type === "add" ? "Bonus Credit" : "Deduct Debit"})`;
      const earningsRef = collection(db, `${artifactRoot}/users/${selectedUser.uid}/earnings`);
      await addDoc(earningsRef, {
        amount: type === "deduct" ? -amt : amt,
        source: eventSource,
        timestamp: serverTimestamp()
      });

      onShowToast("Balance updated successfully", "success");
      
      // Update local state
      const updatedUser = { ...selectedUser, balance: newBalance, totalEarned: newTotal };
      setSelectedUser(updatedUser);
      setMembers((prev) => prev.map((m) => (m.uid === selectedUser.uid ? updatedUser : m)));
      setBalanceAdjustAmount("");
      setGiftReason("");
    } catch (err: any) {
      onShowToast("Failed to adjust balance: " + err.message, "error");
    }
  };

  // Withdrawal Actions
  const handleUpdateWithdrawalStatus = async (record: WithdrawalRecord, nextStatus: "paid" | "rejected") => {
    try {
      const recordRef = doc(db, `${artifactRoot}/public/data/withdrawals`, record.id);
      
      // If rejected, process refund automatically
      if (nextStatus === "rejected") {
        const userRef = doc(db, `${artifactRoot}/users/${record.userId}/profile`, "main");
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const uData = userSnap.data() as UserProfile;
          const currentBal = uData.balance || 0;
          const currentTot = uData.totalEarned || 0;
          
          await updateDoc(userRef, {
            balance: currentBal + record.amount,
            totalEarned: currentTot + record.amount
          });

          // Log refund in earnings history
          const earningsRef = collection(db, `${artifactRoot}/users/${record.userId}/earnings`);
          await addDoc(earningsRef, {
            amount: record.amount,
            source: `Refunded: Rejected Withdrawal (${record.method})`,
            timestamp: serverTimestamp()
          });
        }
      }

      await updateDoc(recordRef, {
        status: nextStatus,
        refundProcessed: nextStatus === "rejected" ? true : record.refundProcessed
      });

      onShowToast(`Withdrawal status updated to: ${nextStatus.toUpperCase()}`, "success");
      
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === record.id ? { ...w, status: nextStatus, refundProcessed: nextStatus === "rejected" ? true : w.refundProcessed } : w))
      );
    } catch (err: any) {
      onShowToast("Failed to update status: " + err.message, "error");
    }
  };

  // Global Settings save
  const handleSaveSettings = async () => {
    try {
      const settingsRef = doc(db, `${artifactRoot}/public/data/settings`, "global");
      await setDoc(settingsRef, {
        ...settingsForm,
        gameReward: Number(settingsForm.gameReward),
        tttReward: Number(settingsForm.tttReward),
        mathReward: Number(settingsForm.mathReward),
        referralBonus: Number(settingsForm.referralBonus),
        signupBonus: Number(settingsForm.signupBonus),
        minWithdraw: Number(settingsForm.minWithdraw),
        dailyCheckInReward: Number(settingsForm.dailyCheckInReward || 200),
        adReward: Number(settingsForm.adReward || 150)
      });
      onShowToast("Global configurations saved to database!", "success");
    } catch (err: any) {
      onShowToast("Failed to save settings: " + err.message, "error");
    }
  };

  // Custom Payment methods managers
  const handleAddPaymentMethod = () => {
    if (!customPayMethod.trim()) return;
    const clean = customPayMethod.trim();
    if (settingsForm.paymentMethods.includes(clean)) {
      onShowToast("Payment method already exists", "info");
      return;
    }
    setSettingsForm({
      ...settingsForm,
      paymentMethods: [...settingsForm.paymentMethods, clean]
    });
    setCustomPayMethod("");
  };

  const handleRemovePaymentMethod = (method: string) => {
    setSettingsForm({
      ...settingsForm,
      paymentMethods: settingsForm.paymentMethods.filter((m) => m !== method)
    });
  };

  // Calculations for Stats Tab
  const totalBalanceInSystem = members.reduce((sum, m) => sum + (m.balance || 0), 0);
  const totalVolumeWithdrawn = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + (w.amount || 0), 0);
  const totalVolumePending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + (w.amount || 0), 0);
  const activeMembersCount = members.filter((m) => !(m as any).disabled).length;
  const disabledMembersCount = members.filter((m) => (m as any).disabled === true).length;

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.uid?.toLowerCase().includes(q) ||
      m.telegramId?.toString().includes(q) ||
      m.referralCode?.toLowerCase().includes(q)
    );
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === "all") return true;
    return w.status === withdrawalFilter;
  });

  // Render Login state first
  if (!isAdminAuth) {
    return (
      <div className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-md z-[150] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white">Admin Credentials</h2>
            <p className="text-xs text-slate-400 mt-1">Provide administrator authorization to enter dashboard</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Admin Email</label>
              <input
                type="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:border-emerald-500 outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Master Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:border-emerald-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition mt-2 flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Admin...</span>
                </>
              ) : (
                <span>Authorize & Enter</span>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#02040a] z-[150] flex flex-col pb-safe">
      {/* Header */}
      <header className="border-b border-slate-800/80 px-4 py-3 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span className="font-extrabold text-sm tracking-wide text-white uppercase">EasyEarnBD Staff Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loadingData}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 active:scale-95 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl active:scale-95 transition"
          >
            Exit Portal
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="flex bg-slate-950 p-1 border-b border-slate-900 sticky top-0 z-10 overflow-x-auto">
        <button
          onClick={() => { setActiveTab("stats"); setSelectedUser(null); }}
          className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap min-w-[80px] ${
            activeTab === "stats" ? "text-emerald-400 bg-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => { setActiveTab("members"); }}
          className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap min-w-[80px] ${
            activeTab === "members" ? "text-emerald-400 bg-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
          }`}
        >
          Members ({members.length})
        </button>
        <button
          onClick={() => { setActiveTab("withdrawals"); setSelectedUser(null); }}
          className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap min-w-[80px] ${
            activeTab === "withdrawals" ? "text-emerald-400 bg-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
          }`}
        >
          Withdrawals ({withdrawals.filter(w => w.status === "pending").length})
        </button>
        <button
          onClick={() => { setActiveTab("settings"); setSelectedUser(null); }}
          className={`flex-1 py-3 text-center text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap min-w-[80px] ${
            activeTab === "settings" ? "text-emerald-400 bg-slate-900 border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
          }`}
        >
          Settings
        </button>
      </nav>

      {/* Body Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {loadingData && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <span>Updating administrator state registries...</span>
          </div>
        )}

        {!loadingData && activeTab === "stats" && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-white">System Core Metrics</h2>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Registers</p>
                <p className="text-2xl font-black text-white mt-1">{members.length}</p>
                <span className="text-[9px] text-emerald-400 font-bold">{activeMembersCount} active / {disabledMembersCount} banned</span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Circulating Wealth</p>
                <p className="text-2xl font-black text-yellow-400 mt-1">{totalBalanceInSystem}</p>
                <span className="text-[9px] text-slate-500 font-medium font-mono">Coins in member wallets</span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Disbursed</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{totalVolumeWithdrawn}</p>
                <span className="text-[9px] text-slate-500 font-medium font-mono">Paid out from withdrawals</span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Awaiting Liquidation</p>
                <p className="text-2xl font-black text-rose-400 mt-1">{totalVolumePending}</p>
                <span className="text-[9px] text-slate-500 font-medium font-mono">Pending in checkout queue</span>
              </div>
            </div>

            {/* Quick Summary list of pending withdrawals */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-400" />
                  <span>Awaiting Approval ({withdrawals.filter(w => w.status === "pending").length})</span>
                </h3>
                <button onClick={() => setActiveTab("withdrawals")} className="text-xs text-emerald-400 font-extrabold uppercase hover:underline">
                  Go to queue
                </button>
              </div>

              <div className="space-y-2">
                {withdrawals.filter(w => w.status === "pending").length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Congratulations, withdrawal checkout queue is clean!</p>
                ) : (
                  withdrawals.filter(w => w.status === "pending").slice(0, 4).map((w) => (
                    <div key={w.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-white">{w.userName || "No name"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{w.method}: {w.details}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-400">-{w.amount} Coins</p>
                        <p className="text-[9px] text-slate-400 font-mono">৳{Math.floor(w.amount / 500)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!loadingData && activeTab === "members" && (
          <div className="space-y-4">
            {/* Online Status & Last Active Users Section */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 text-left">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Online Status & Last Online List</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Real-time active presence tracking</p>
                </div>
                <div className="bg-slate-950 px-3 py-1 rounded-full border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400">Total Online: </span>
                  <span className="text-xs font-black text-emerald-400">
                    {members.filter(m => {
                      if (!m.lastOnline) return false;
                      let lastMs = 0;
                      if (m.lastOnline.seconds) lastMs = m.lastOnline.seconds * 1000;
                      else if (m.lastOnline instanceof Date) lastMs = m.lastOnline.getTime();
                      else lastMs = new Date(m.lastOnline).getTime();
                      return Date.now() - lastMs <= 300000; // 5 minutes
                    }).length} Users
                  </span>
                </div>
              </div>

              {/* Users list scrolling list */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scroll">
                {members.filter(m => m.lastOnline).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No active presence data synchronized yet.</p>
                ) : (
                  [...members]
                    .filter(m => m.lastOnline)
                    .sort((a, b) => {
                      let aMs = 0;
                      if (a.lastOnline.seconds) aMs = a.lastOnline.seconds * 1000;
                      else if (a.lastOnline instanceof Date) aMs = a.lastOnline.getTime();
                      else aMs = new Date(a.lastOnline).getTime();

                      let bMs = 0;
                      if (b.lastOnline.seconds) bMs = b.lastOnline.seconds * 1000;
                      else if (b.lastOnline instanceof Date) bMs = b.lastOnline.getTime();
                      else bMs = new Date(b.lastOnline).getTime();

                      return bMs - aMs;
                    })
                    .slice(0, 20)
                    .map((user) => {
                      let lastMs = 0;
                      if (user.lastOnline.seconds) lastMs = user.lastOnline.seconds * 1000;
                      else if (user.lastOnline instanceof Date) lastMs = user.lastOnline.getTime();
                      else lastMs = new Date(user.lastOnline).getTime();

                      const isOnline = Date.now() - lastMs <= 300000; // 5 minutes
                      
                      let formattedTime = "";
                      const diffMin = Math.floor((Date.now() - lastMs) / 60000);
                      if (diffMin < 1) {
                        formattedTime = "Just now";
                      } else if (diffMin < 60) {
                        formattedTime = `${diffMin}m ago`;
                      } else {
                        const diffHrs = Math.floor(diffMin / 60);
                        if (diffHrs < 24) {
                          formattedTime = `${diffHrs}h ago`;
                        } else {
                          formattedTime = new Date(lastMs).toLocaleDateString();
                        }
                      }

                      return (
                        <div
                          key={user.uid}
                          onClick={() => setSelectedUser(user)}
                          className="flex justify-between items-center bg-slate-950 border border-slate-900 px-3 py-2 rounded-xl hover:border-slate-800 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <img
                                src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.firstName || "User"}&background=random`}
                                className="w-7 h-7 rounded-full border border-slate-800"
                                alt=""
                              />
                              <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-950 ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}></span>
                            </div>
                            <span className="text-xs font-bold text-white">{user.firstName || "Anon User"}</span>
                          </div>
                          
                          <div className="text-right flex items-center gap-1.5">
                            <span className={`text-[9px] font-mono font-bold ${isOnline ? "text-emerald-400" : "text-slate-500"}`}>
                              {isOnline ? "ONLINE" : formattedTime}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by first name, UID, telegram ID or code..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              {memberSearch && (
                <button onClick={() => setMemberSearch("")} className="absolute right-3 top-3 py-0.5 px-2 bg-slate-800 text-[10px] font-bold text-slate-400 rounded hover:text-white">
                  Clear
                </button>
              )}
            </div>

            {/* Main view split for members */}
            <div className="space-y-3">
              {filteredMembers.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">No member profiles found mapping parameters.</p>
              ) : (
                filteredMembers.slice(0, 50).map((user) => {
                  const isBanned = (user as any).disabled === true;
                  return (
                    <div
                      key={user.uid}
                      onClick={() => setSelectedUser(user)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                        selectedUser?.uid === user.uid
                          ? "bg-emerald-950/20 border-emerald-500/80 shadow-md"
                          : isBanned
                          ? "bg-slate-900/40 border-rose-950/40 opacity-70"
                          : "bg-slate-900 border-slate-800/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.firstName || "User"}&background=random`}
                            className="w-9 h-9 rounded-full bg-slate-950 border border-slate-800"
                            alt=""
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white">{user.firstName || "Anon User"}</span>
                              {isBanned && (
                                <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[8px] px-1 py-0.5 rounded uppercase font-extrabold tracking-widest">
                                  Banned
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">TG ID: {user.telegramId || "No Telegram"}</p>
                            <p className="text-[9px] text-slate-500 font-mono">RefCode: {user.referralCode || "N/A"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-yellow-400 block">{user.balance || 0} Coins</span>
                          <span className="text-[9px] text-slate-500 block">Total Earned: {user.totalEarned || 0}</span>
                          <span className="text-[9px] text-slate-500 block">Refers: {user.totalRefers || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected User Actions Drawer */}
            <AnimatePresence>
              {selectedUser && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  className="fixed bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-slate-900 border-t border-slate-800 rounded-t-[32px] p-6 shadow-2xl z-[160]"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedUser.photoUrl || `https://ui-avatars.com/api/?name=${selectedUser.firstName}&background=random`}
                        className="w-12 h-12 rounded-full border border-slate-700 bg-slate-950"
                        alt=""
                      />
                      <div>
                        <h3 className="text-lg font-black text-white">{selectedUser.firstName}</h3>
                        <p className="text-xs text-slate-400 font-mono">UID: {selectedUser.uid}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Security & Access Blocks */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleUserStatus(selectedUser)}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                          (selectedUser as any).disabled === true
                            ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-rose-600/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                        }`}
                      >
                        <Ban className="w-4 h-4" />
                        <span>{(selectedUser as any).disabled === true ? "Unban & Enable" : "Ban & Disable Member"}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteUserDoc(selectedUser)}
                        className="py-3 px-4 rounded-xl text-xs font-extrabold bg-rose-600 text-white flex items-center justify-center gap-1.5 hover:bg-rose-500 active:scale-95 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Profile Data</span>
                      </button>
                    </div>

                    {/* Balance Operations */}
                    <div className="bg-[#080d1a] border border-slate-800 rounded-2xl p-4 space-y-4">
                      <p className="text-xs font-black uppercase text-slate-300 tracking-wider">Balance Adjustment Engines</p>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">Coin Amount</label>
                        <input
                          type="number"
                          placeholder="Ex. 500, 1000, 5000"
                          value={balanceAdjustAmount}
                          onChange={(e) => setBalanceAdjustAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAdjustBalance("add")}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 shadow active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Direct Add Coins</span>
                        </button>
                        <button
                          onClick={() => handleAdjustBalance("deduct")}
                          className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 shadow active:scale-95 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                          <span>Deduct Coins</span>
                        </button>
                      </div>

                      <div className="pt-3 border-t border-slate-800/60 space-y-3">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">Send Special Gift Event</p>
                        <input
                          type="text"
                          placeholder="Reason: e.g. Special Telegram Referral Event Winner"
                          value={giftReason}
                          onChange={(e) => setGiftReason(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition"
                        />
                        <button
                          onClick={() => handleAdjustBalance("gift")}
                          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                        >
                          <Gift className="w-4 h-4 text-purple-200 fill-purple-300" />
                          <span>Credit Gift & Notify History</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!loadingData && activeTab === "withdrawals" && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900">
              {(["all", "pending", "paid", "rejected"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setWithdrawalFilter(filter)}
                  className={`flex-1 py-2 text-center text-[10px] font-extrabold uppercase rounded-lg tracking-wider transition-all ${
                    withdrawalFilter === filter ? "bg-slate-900 text-emerald-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredWithdrawals.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">No withdrawals matching criteria.</p>
              ) : (
                filteredWithdrawals.map((record) => {
                  return (
                    <div key={record.id} className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl space-y-3 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-white">{record.userName || "No username"}</span>
                            <span className="text-[9px] font-mono text-slate-500">UID: {record.userId.substring(0, 8)}...</span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            Method: <span className="font-extrabold text-slate-200">{record.method}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono leading-relaxed mt-1">
                            Details: <span className="text-white font-extrabold underline">{record.details}</span>
                          </p>
                          {record.timestamp?.seconds && (
                            <p className="text-[9px] text-slate-500 mt-1">
                              Submitted: {new Date(record.timestamp.seconds * 1000).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-400 block">-{record.amount} Coins</span>
                          <span className="text-[10px] font-black text-slate-300 block">৳{Math.floor(record.amount / 500)}</span>
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-widest block mt-1.5 ${
                              record.status === "paid"
                                ? "text-emerald-400"
                                : record.status === "rejected"
                                ? "text-rose-400"
                                : "text-yellow-400"
                            }`}
                          >
                            ● {record.status}
                          </span>
                        </div>
                      </div>

                      {record.status === "pending" && (
                        <div className="flex gap-2 pt-2 border-t border-slate-800/40">
                          <button
                            onClick={() => handleUpdateWithdrawalStatus(record, "paid")}
                            className="flex-1 py-2 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Paid</span>
                          </button>
                          <button
                            onClick={() => handleUpdateWithdrawalStatus(record, "rejected")}
                            className="flex-1 py-2 bg-rose-600/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject & Auto-Refund</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {!loadingData && activeTab === "settings" && (
          <div className="space-y-6 text-left">
            <h2 className="text-lg font-black text-white">Application Reward Config</h2>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4">
              {/* Coin Value */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Coin Exchange Formula Value</label>
                <input
                  type="text"
                  value={settingsForm.coinValue}
                  onChange={(e) => setSettingsForm({ ...settingsForm, coinValue: e.target.value })}
                  placeholder="e.g. 1 BDT"
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                />
                <p className="text-[9px] text-slate-500 mt-1">This value is mapped for every 500 reward coins (e.g. 500 Coin = {settingsForm.coinValue})</p>
              </div>

              {/* Minimum Withdraw */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Minimum Checkout Coins Limit</label>
                <input
                  type="number"
                  value={settingsForm.minWithdraw}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minWithdraw: Number(e.target.value) })}
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                />
                <p className="text-[9px] text-slate-500 mt-1">Notify Toast trigger occurs below this threshold. Must be at least 10,000</p>
              </div>

              {/* Standard Rewards Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Game Winner Reward</label>
                  <input
                    type="number"
                    value={settingsForm.gameReward}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gameReward: Number(e.target.value) })}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">TicTacToe Reward</label>
                  <input
                    type="number"
                    value={settingsForm.tttReward}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tttReward: Number(e.target.value) })}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Math Solver Reward</label>
                  <input
                    type="number"
                    value={settingsForm.mathReward}
                    onChange={(e) => setSettingsForm({ ...settingsForm, mathReward: Number(e.target.value) })}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Referral Bonus</label>
                  <input
                    type="number"
                    value={settingsForm.referralBonus}
                    onChange={(e) => setSettingsForm({ ...settingsForm, referralBonus: Number(e.target.value) })}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Registration/Signup Bonus</label>
                <input
                  type="number"
                  value={settingsForm.signupBonus}
                  onChange={(e) => setSettingsForm({ ...settingsForm, signupBonus: Number(e.target.value) })}
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                />
              </div>

              {/* Daily Check-In Reward */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Daily Check-In Reward</label>
                <input
                  type="number"
                  value={settingsForm.dailyCheckInReward || 200}
                  onChange={(e) => setSettingsForm({ ...settingsForm, dailyCheckInReward: Number(e.target.value) })}
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                />
              </div>

              {/* Sponsor Direct Link Advertisements Section */}
              <div className="pt-4 border-t border-slate-800/60 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider">Direct Sponsor Ad configuration</h3>
                
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Sponsor Ad Redirect Link</label>
                  <input
                    type="text"
                    value={settingsForm.adLink || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, adLink: e.target.value })}
                    placeholder="e.g. https://sponsorlink.com"
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Sponsor Ad Image URL</label>
                  <input
                    type="text"
                    value={settingsForm.adImage || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, adImage: e.target.value })}
                    placeholder="e.g. https://easyearn.com/sponsor-banner.jpg"
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Sponsor Visit Reward (Coins)</label>
                  <input
                    type="number"
                    value={settingsForm.adReward || 150}
                    onChange={(e) => setSettingsForm({ ...settingsForm, adReward: Number(e.target.value) })}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Dynamic Payment method management */}
              <div className="pt-4 border-t border-slate-800/60 space-y-3">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Allowed Checkouts Methods</label>
                <div className="flex flex-wrap gap-1.5">
                  {settingsForm.paymentMethods.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-xl text-xs text-slate-300 font-medium">
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentMethod(m)}
                        className="text-rose-400 hover:text-rose-300 p-0.5 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New payment method name (e.g. Rocket)"
                    value={customPayMethod}
                    onChange={(e) => setCustomPayMethod(e.target.value)}
                    className="flex-1 bg-[#080d1a] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 rounded-xl transition active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                <span>Save Reward Configurations</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
