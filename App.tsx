/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameStatus, NoteData, ScoreTier, Difficulty } from './types';
import { SONG_URL, SABER_CATALOG, DIFFICULTY_CONFIG, generateChart } from './constants';
import { useMediaPipe } from './hooks/useMediaPipe';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import { Play, RefreshCw, VideoOff, ShoppingBag, Lock, Check, Coins, ArrowLeft, TrendingUp, Zap, Camera, Disc, Activity, Power, Shield, User, ChevronRight, Key, Trash2, Database, LogOut, Users, Eye, EyeOff, Gamepad2, Ban, Skull } from 'lucide-react';

interface PlayerData {
    username: string;
    level: number;
    coins: number;
    saberName: string;
}

// Simple deterministic chart generator for Admin Dashboard
const ActivityChart = ({ seed }: { seed: string }) => {
    const points = useMemo(() => {
        const data = [];
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        
        // Generate 6 points
        for (let i = 0; i < 6; i++) {
             // Pseudo random fluctuation
             const val = (Math.abs(Math.sin(hash + i * 132)) * 0.6 + 0.2) * 20; 
             data.push(val); 
        }
        return data;
    }, [seed]);

    return (
        <div className="w-full h-8 flex items-center justify-center opacity-70">
            <svg width="100%" height="100%" viewBox="0 0 100 20" overflow="visible">
                <defs>
                    <linearGradient id={`grad-${seed}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
                    </linearGradient>
                </defs>
                <polyline 
                    points={points.map((y, i) => `${i * 20},${20 - y}`).join(' ')} 
                    fill="none" 
                    stroke={`url(#grad-${seed})`} 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
                {points.map((y, i) => (
                    <circle 
                        key={i} 
                        cx={i * 20} 
                        cy={20 - y} 
                        r={i === points.length - 1 ? 2.5 : 1.5} 
                        fill={i === points.length - 1 ? "#60a5fa" : "#1e40af"} 
                    />
                ))}
            </svg>
        </div>
    );
};

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [introStarted, setIntroStarted] = useState(false);
  
  // Login State
  const [username, setUsername] = useState<string>('');
  const [loginInput, setLoginInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [allPlayers, setAllPlayers] = useState<PlayerData[]>([]);

  // Gameplay State
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [health, setHealth] = useState(100);
  
  // HUD Animation States
  const [damageAnim, setDamageAnim] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Game Settings
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [activeChart, setActiveChart] = useState<NoteData[]>([]);

  // Economy State (Initialized to defaults, loaded on login)
  const [coins, setCoins] = useState<number>(0);
  const [inventory, setInventory] = useState<string[]>(['default']);
  const [equippedSaberId, setEquippedSaberId] = useState<string>('default');
  const [xp, setXp] = useState<number>(0);

  const [showShop, setShowShop] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(new Audio(SONG_URL));
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cheat Code Refs
  const cheatClicksRef = useRef(0);
  const cheatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hand Tracking Hook
  const { isCameraReady, handPositionsRef, lastResultsRef, error: cameraError, isModelLoaded, requestCameraPermission } = useMediaPipe(videoRef);

  // Derived Stats
  const level = useMemo(() => Math.floor(Math.sqrt(xp / 100)) + 1, [xp]);
  const progressToNextLevel = useMemo(() => {
      const currentLevelBase = (level - 1) * (level - 1) * 100;
      const nextLevelBase = level * level * 100;
      return ((xp - currentLevelBase) / (nextLevelBase - currentLevelBase)) * 100;
  }, [xp, level]);

  // Level Up Logic
  const [prevLevel, setPrevLevel] = useState(1);
  // Sync prevLevel on load
  useEffect(() => {
      if (level > prevLevel) {
          if (introStarted && !isAdmin) {
              setShowLevelUp(true);
              // Reduced to 1500ms
              setTimeout(() => setShowLevelUp(false), 1500);
          }
          setPrevLevel(level);
      }
  }, [level, prevLevel, introStarted, isAdmin]);

  const equippedItem = useMemo(() => 
    SABER_CATALOG.find(s => s.id === equippedSaberId) || SABER_CATALOG[0], 
  [equippedSaberId]);

  // Dynamic Difficulty: Speed increases with Level
  const diffConfig = useMemo(() => DIFFICULTY_CONFIG[difficulty], [difficulty]);
  
  const levelSpeedBonus = useMemo(() => {
      // Increase speed by 0.5 per level, capped at +8
      return Math.min((level - 1) * 0.5, 8);
  }, [level]);

  const activeNoteSpeed = useMemo(() => {
      return diffConfig.speed + levelSpeedBonus;
  }, [diffConfig.speed, levelSpeedBonus]);

  // Persist Data (Scoped to Username)
  useEffect(() => { 
      if (username && introStarted && !isAdmin) localStorage.setItem(`ts_user_${username}_coins`, coins.toString()); 
  }, [coins, username, introStarted, isAdmin]);
  
  useEffect(() => { 
      if (username && introStarted && !isAdmin) localStorage.setItem(`ts_user_${username}_inventory`, JSON.stringify(inventory)); 
  }, [inventory, username, introStarted, isAdmin]);
  
  useEffect(() => { 
      if (username && introStarted && !isAdmin) localStorage.setItem(`ts_user_${username}_equipped`, equippedSaberId); 
  }, [equippedSaberId, username, introStarted, isAdmin]);
  
  useEffect(() => { 
      if (username && introStarted && !isAdmin) localStorage.setItem(`ts_user_${username}_xp`, xp.toString()); 
  }, [xp, username, introStarted, isAdmin]);

  // Global Cheat Click Handler
  const handleGlobalClick = () => {
    if (cheatTimeoutRef.current) clearTimeout(cheatTimeoutRef.current);

    cheatClicksRef.current += 1;

    if (cheatClicksRef.current >= 18) {
        // UNLOCK EVERYTHING
        const allIds = SABER_CATALOG.map(s => s.id);
        setInventory(allIds);
        setCoins(9999999);
        cheatClicksRef.current = 0;
        
        // Visual Feedback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
        alert("GOD MODE ENABLED: INVENTORY & CREDITS MAXED");
    } else {
        cheatTimeoutRef.current = setTimeout(() => {
            cheatClicksRef.current = 0;
        }, 1000); // 1 second reset window
    }
  };

  // Game Logic Handlers
  const handleNoteHit = useCallback((note: NoteData, tier: ScoreTier) => {
     let points = 0;
     let coinReward = 0;
     let healthBonus = 0;
     
     // Base rewards
     switch (tier) {
         case ScoreTier.PERFECT: points = 150; coinReward = 15; healthBonus = diffConfig.healthGain; break;
         case ScoreTier.GREAT: points = 100; coinReward = 10; healthBonus = diffConfig.healthGain * 0.8; break;
         case ScoreTier.GOOD: points = 70; coinReward = 5; healthBonus = diffConfig.healthGain * 0.5; break;
         case ScoreTier.OK: points = 40; coinReward = 2; healthBonus = diffConfig.healthGain * 0.2; break;
         case ScoreTier.BAD: points = 10; coinReward = 1; healthBonus = 0; break;
         case ScoreTier.WRONG_SABER: points = 0; coinReward = 0; healthBonus = -5; break;
         case ScoreTier.GOLD_STAR: points = 1000; coinReward = 150; healthBonus = 50; break;
     }

     // Apply Perks & Difficulty Multipliers (only if points > 0)
     if (points > 0) {
        const diffMult = diffConfig.scoreMultiplier;
        points = Math.round(points * equippedItem.perks.scoreMult * diffMult);
        coinReward = Math.round(coinReward * equippedItem.perks.coinMult * diffMult);
     }

     // Haptic feedback
     if (navigator.vibrate) {
         if (tier === ScoreTier.PERFECT || tier === ScoreTier.GOLD_STAR) navigator.vibrate(50);
         else if (tier === ScoreTier.BAD || tier === ScoreTier.WRONG_SABER) navigator.vibrate([30, 30, 30]);
         else navigator.vibrate(20);
     }

     // Combo Logic
     if (tier !== ScoreTier.BAD && tier !== ScoreTier.WRONG_SABER) {
         setCombo(c => {
           const newCombo = c + 1;
           if (newCombo > 30) setMultiplier(8);
           else if (newCombo > 20) setMultiplier(4);
           else if (newCombo > 10) setMultiplier(2);
           else setMultiplier(1);
           return newCombo;
         });
     } else {
         setCombo(c => Math.max(0, c - 5)); 
         setMultiplier(prev => Math.max(1, prev / 2));
         // Trigger damage animation
         setDamageAnim(true);
         setTimeout(() => setDamageAnim(false), 200);
     }

     setScore(s => s + (points * multiplier));
     setHealth(h => Math.min(100, Math.max(0, h + healthBonus)));
     setCoins(c => c + coinReward);
     setXp(x => x + (points / 5)); 

  }, [multiplier, equippedItem, diffConfig]);

  const endGame = useCallback((victory: boolean) => {
    setGameStatus(victory ? GameStatus.VICTORY : GameStatus.GAME_OVER);
    audioRef.current.pause();
  }, []);

  const handleNoteMiss = useCallback((note: NoteData) => {
      setCombo(0);
      setMultiplier(1);
      setDamageAnim(true);
      setTimeout(() => setDamageAnim(false), 200);
      setHealth(h => {
          const newHealth = h - diffConfig.healthDrain; 
          if (newHealth <= 0) {
             // Defer game over to avoid state clash during render
             setTimeout(() => endGame(false), 0);
             return 0;
          }
          return newHealth;
      });
  }, [diffConfig, endGame]);

  const loadAdminData = () => {
      const users = new Set<string>();
      // Scan local storage for users
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('ts_user_')) {
              // Format: ts_user_USERNAME_suffix
              const parts = key.split('_');
              // parts[0]=ts, parts[1]=user, parts[2]=USERNAME
              if (parts.length >= 3) {
                  users.add(parts[2]);
              }
          }
      }

      const data: PlayerData[] = Array.from(users)
          .filter(u => btoa(u) !== 'QUtCQVI=') // EXCLUDE ADMIN (Obfuscated)
          .map(u => {
          const xpRaw = parseInt(localStorage.getItem(`ts_user_${u}_xp`) || '0', 10);
          const lvl = Math.floor(Math.sqrt(xpRaw / 100)) + 1;
          const money = parseInt(localStorage.getItem(`ts_user_${u}_coins`) || '0', 10);
          const saberId = localStorage.getItem(`ts_user_${u}_equipped`) || 'default';
          const saber = SABER_CATALOG.find(s => s.id === saberId)?.name || 'Standard Issue';
          
          return {
              username: u,
              level: lvl,
              coins: money,
              saberName: saber
          };
      });
      setAllPlayers(data.sort((a,b) => b.level - a.level)); // Sort by level high to low
  };

  const handleBanPlayer = (targetUser: string) => {
      // SECURITY OVERRIDE FOR AHMET
      if (targetUser === 'AHMET') {
          const code = prompt("SECURITY ALERT: PROTECTED PRINCIPAL AGENT.\nENTER OVERRIDE AUTHORIZATION CODE:");
          // Check for 'aa.WEB.DEV9777!' via Base64 obfuscation to prevent code reading
          if (!code || btoa(code) !== 'YWEuV0VCLkRFVjk3Nzch') {
              alert("ACCESS DENIED: INSUFFICIENT SECURITY CLEARANCE.");
              return;
          }
      }

      if (window.confirm(`PERMANENTLY BAN AGENT ${targetUser}? \nThis action cannot be undone.`)) {
          // Remove all associated keys
          localStorage.removeItem(`ts_user_${targetUser}_auth`);
          localStorage.removeItem(`ts_user_${targetUser}_coins`);
          localStorage.removeItem(`ts_user_${targetUser}_inventory`);
          localStorage.removeItem(`ts_user_${targetUser}_equipped`);
          localStorage.removeItem(`ts_user_${targetUser}_xp`);
          
          // Refresh list
          loadAdminData();
      }
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      const user = loginInput.trim().toUpperCase();
      const pass = passwordInput; // Keep password raw for exact match

      if (!user || !pass) {
          setLoginError("CREDENTIALS REQUIRED");
          return;
      }

      // SUPER USER CHECK: AHMET
      if (user === 'AHMET' && pass === 'hers ring told') {
          setIsAdmin(true);
          loadAdminData();
          return;
      }

      // ADMIN CHECK - Exclusive block (Obfuscated)
      // Checks against Base64 encoded values to hide plain text in source
      if (btoa(user) === 'QUtCQVI=') {
          if (btoa(pass) === 'dGhlIGJpbiBhdGU=') {
             setIsAdmin(true);
             loadAdminData();
             return;
          } else {
             setLoginError("INVALID ADMIN PASSCODE");
             return;
          }
      }

      // Standard User Login
      const storedPass = localStorage.getItem(`ts_user_${user}_auth`);
      
      if (storedPass) {
          if (storedPass !== pass) {
              setLoginError("ACCESS DENIED: INVALID PASSCODE");
              return;
          }
          // Load User Data
          const savedCoins = parseInt(localStorage.getItem(`ts_user_${user}_coins`) || '0', 10);
          const savedInv = JSON.parse(localStorage.getItem(`ts_user_${user}_inventory`) || '["default"]');
          const savedEquip = localStorage.getItem(`ts_user_${user}_equipped`) || 'default';
          const savedXp = parseInt(localStorage.getItem(`ts_user_${user}_xp`) || '0', 10);

          setCoins(savedCoins);
          setInventory(savedInv);
          setEquippedSaberId(savedEquip);
          setXp(savedXp);
      } else {
          // Register New User
          localStorage.setItem(`ts_user_${user}_auth`, pass);
          localStorage.setItem(`ts_user_${user}_coins`, '0');
          localStorage.setItem(`ts_user_${user}_inventory`, JSON.stringify(['default']));
          localStorage.setItem(`ts_user_${user}_equipped`, 'default');
          localStorage.setItem(`ts_user_${user}_xp`, '0');

          setCoins(0);
          setInventory(['default']);
          setEquippedSaberId('default');
          setXp(0);
      }

      setUsername(user);
      setIntroStarted(true);
      setGameStatus(GameStatus.IDLE);
      setLoginInput('');
      setPasswordInput('');
  };

  const handleLogout = () => {
    setIntroStarted(false);
    setIsAdmin(false);
    setUsername('');
    setGameStatus(GameStatus.LOADING);
  };

  const startGame = () => {
    setActiveChart(generateChart(difficulty));
    setGameStatus(GameStatus.PLAYING);
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(100);
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const retryGame = () => {
      startGame();
  };

  const buyItem = (item: any) => {
      if (coins >= item.price && !inventory.includes(item.id)) {
          setCoins(c => c - item.price);
          setInventory(prev => [...prev, item.id]);
          setEquippedSaberId(item.id);
      } else if (inventory.includes(item.id)) {
          setEquippedSaberId(item.id);
      }
  };

  return (
    <div className="w-full h-full relative bg-black text-white font-mono overflow-hidden select-none" onClick={handleGlobalClick}>
      
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
         <Canvas shadows dpr={[1, 2]}>
            <GameScene 
               gameStatus={gameStatus}
               audioRef={audioRef}
               handPositionsRef={handPositionsRef}
               chart={activeChart}
               noteSpeed={activeNoteSpeed}
               onNoteHit={handleNoteHit}
               onNoteMiss={handleNoteMiss}
               onSongEnd={() => endGame(true)}
               equippedSaber={equippedItem}
               combo={combo}
            />
         </Canvas>
      </div>

      {/* WEBCAM PREVIEW */}
      {introStarted && !isAdmin && (
          <WebcamPreview videoRef={videoRef} resultsRef={lastResultsRef} isCameraReady={isCameraReady} />
      )}

      {/* LOGIN SCREEN */}
      {!introStarted && !isAdmin && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
             <div className="w-full max-w-md p-8 border border-blue-500/30 bg-black/90 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                 <div className="text-center mb-8">
                     <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tighter mb-2 animate-pulse-fast">TEMPO STRIKE</h1>
                     <p className="text-xs text-blue-400/60 tracking-[0.3em]">SECURE TERMINAL ACCESS</p>
                 </div>
                 
                 <form onSubmit={handleLogin} className="space-y-6">
                     <div className="space-y-2">
                         <label className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">Agent ID</label>
                         <div className="relative">
                             <User className="absolute left-3 top-3 w-5 h-5 text-blue-500/50" />
                             <input 
                                type="text" 
                                value={loginInput}
                                onChange={(e) => setLoginInput(e.target.value)}
                                className="w-full bg-blue-900/10 border border-blue-500/30 rounded-lg py-3 pl-10 pr-4 text-blue-100 placeholder-blue-500/20 focus:outline-none focus:border-blue-400 focus:bg-blue-900/20 transition-all"
                                placeholder="ENTER CODENAME"
                             />
                         </div>
                     </div>
                     
                     <div className="space-y-2">
                         <label className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">Passcode</label>
                         <div className="relative">
                             <Key className="absolute left-3 top-3 w-5 h-5 text-blue-500/50" />
                             <input 
                                type={showPassword ? "text" : "password"} 
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full bg-blue-900/10 border border-blue-500/30 rounded-lg py-3 pl-10 pr-12 text-blue-100 placeholder-blue-500/20 focus:outline-none focus:border-blue-400 focus:bg-blue-900/20 transition-all"
                                placeholder="••••••••"
                             />
                             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-blue-500/50 hover:text-blue-400">
                                 {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                             </button>
                         </div>
                     </div>

                     {loginError && (
                         <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 p-3 rounded border border-red-500/30 animate-shake">
                             <Ban size={14} />
                             {loginError}
                         </div>
                     )}

                     <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group">
                         <span>INITIALIZE LINK</span>
                         <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                     </button>
                 </form>

                 <div className="mt-8 pt-6 border-t border-blue-500/10 text-center">
                     <p className="text-[10px] text-blue-500/40">
                         SYSTEM VERSION 2.0.4 <br/> 
                         UNAUTHORIZED ACCESS IS A FEDERAL OFFENSE
                     </p>
                 </div>
             </div>
          </div>
      )}

      {/* ADMIN DASHBOARD */}
      {isAdmin && (
          <div className="absolute inset-0 z-50 bg-[#0a0f1c] text-blue-400 font-mono overflow-auto pointer-events-auto flex flex-col">
              <div className="p-6 border-b border-blue-800/50 bg-[#050810] flex justify-between items-center sticky top-0 z-10 shadow-lg">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-500/10 rounded flex items-center justify-center border border-red-500/50 animate-pulse">
                          <Database className="text-red-500" />
                      </div>
                      <div>
                          <h1 className="text-2xl font-bold text-white tracking-widest">OVERSEER TERMINAL</h1>
                          <p className="text-xs text-red-400">HIGHER AUTHORITY ACCESS GRANTED</p>
                      </div>
                  </div>
                  <button onClick={handleLogout} className="px-4 py-2 border border-blue-800 rounded hover:bg-blue-900/50 flex items-center gap-2 transition-colors">
                      <LogOut size={16} /> DISCONNECT
                  </button>
              </div>

              <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allPlayers.map((player) => (
                      <div key={player.username} className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all group">
                          <div className="p-4 border-b border-slate-700/50 flex justify-between items-start bg-slate-900">
                              <div>
                                  <div className="text-xs text-slate-500 uppercase mb-1">Agent ID</div>
                                  <div className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{player.username}</div>
                              </div>
                              {player.username === 'AHMET' ? (
                                   <Shield className="text-yellow-500 w-5 h-5" />
                              ) : (
                                   <div className="w-2 h-2 rounded-full bg-green-500 mt-2 shadow-[0_0_10px_#22c55e]" />
                              )}
                          </div>
                          
                          <div className="p-4 space-y-4">
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-black/40 p-3 rounded">
                                       <div className="text-[10px] text-slate-500 uppercase">Clearance</div>
                                       <div className="text-lg font-mono text-cyan-400">LVL {player.level}</div>
                                   </div>
                                   <div className="bg-black/40 p-3 rounded">
                                       <div className="text-[10px] text-slate-500 uppercase">Credits</div>
                                       <div className="text-lg font-mono text-yellow-500">{player.coins.toLocaleString()}</div>
                                   </div>
                               </div>
                               
                               <div className="bg-black/40 p-3 rounded">
                                   <div className="text-[10px] text-slate-500 uppercase mb-1">Equipment</div>
                                   <div className="flex items-center gap-2 text-sm text-white">
                                       <Zap size={14} className="text-purple-400" />
                                       {player.saberName}
                                   </div>
                               </div>

                               <div className="bg-black/40 p-3 rounded">
                                    <div className="text-[10px] text-slate-500 uppercase mb-1">Recent Activity</div>
                                    <ActivityChart seed={player.username} />
                               </div>

                               <button 
                                  onClick={() => handleBanPlayer(player.username)}
                                  className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 rounded flex items-center justify-center gap-2 transition-all text-sm"
                               >
                                   <Trash2 size={14} /> TERMINATE ACCOUNT
                               </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* GAME UI LAYER */}
      {introStarted && !isAdmin && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
              
              {/* TOP BAR */}
              <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-2 pointer-events-auto">
                      <div className="flex items-center gap-4 bg-black/60 backdrop-blur rounded-full p-1 pr-6 border border-white/10">
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                              {level}
                          </div>
                          <div className="flex flex-col w-32">
                              <div className="flex justify-between text-[10px] font-bold text-blue-200 uppercase mb-1">
                                  <span>XP</span>
                                  <span>{Math.floor(progressToNextLevel)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-blue-900/50 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400 shadow-[0_0_10px_#60a5fa]" style={{ width: `${progressToNextLevel}%` }} />
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-yellow-500/20 self-start">
                          <Coins className="text-yellow-400 w-4 h-4" />
                          <span className="text-yellow-400 font-bold">{coins.toLocaleString()}</span>
                      </div>
                  </div>

                  {gameStatus === GameStatus.IDLE && (
                      <button onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-2 rounded-lg border border-red-500/30 transition-all pointer-events-auto">
                          <LogOut size={20} />
                      </button>
                  )}
                  
                  {gameStatus === GameStatus.PLAYING && (
                      <div className="flex flex-col items-end gap-1">
                          <div className="text-6xl font-black italic text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] tabular-nums">
                              {score.toLocaleString()}
                          </div>
                          <div className={`text-2xl font-bold flex items-center gap-2 ${multiplier > 4 ? 'text-red-500 animate-pulse' : multiplier > 1 ? 'text-blue-400' : 'text-slate-500'}`}>
                              <TrendingUp size={24} />
                              x{multiplier}
                          </div>
                      </div>
                  )}
              </div>

              {/* CENTER AREA */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl text-center pointer-events-auto">
                  {gameStatus === GameStatus.IDLE && !showShop && (
                      <div className="flex flex-col items-center gap-8 animate-scan">
                          <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-900 tracking-tighter drop-shadow-2xl">
                              TEMPO STRIKE
                          </h1>
                          
                          <div className="flex items-center gap-6">
                              <button 
                                 onClick={startGame}
                                 className="group relative px-12 py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-2xl tracking-widest transition-all hover:scale-105 shadow-[0_0_40px_rgba(37,99,235,0.4)] overflow-hidden"
                              >
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-shine" />
                                  <div className="flex items-center gap-4">
                                      <Play fill="currentColor" size={28} />
                                      ENGAGE
                                  </div>
                              </button>

                              <button 
                                 onClick={() => setShowShop(true)}
                                 className="p-6 bg-slate-800/80 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-blue-400 transition-all hover:scale-105"
                              >
                                  <ShoppingBag size={28} className="text-blue-400" />
                              </button>
                          </div>

                          {/* Difficulty Selector */}
                          <div className="flex gap-2 p-1 bg-black/50 backdrop-blur rounded-lg border border-white/10 mt-4">
                              {Object.values(Difficulty).map((d) => (
                                  <button
                                      key={d}
                                      onClick={() => setDifficulty(d)}
                                      className={`px-4 py-2 rounded text-xs font-bold transition-all ${difficulty === d 
                                          ? 'bg-blue-600 text-white shadow-lg' 
                                          : 'text-slate-400 hover:bg-white/5'}`}
                                  >
                                      {DIFFICULTY_CONFIG[d].label}
                                  </button>
                              ))}
                          </div>
                          
                          {/* Camera warning */}
                          {!isCameraReady && (
                              <div className="mt-8 flex flex-col items-center gap-3">
                                  <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                                      <Camera size={20} />
                                      {cameraError || "CAMERA OFFLINE"}
                                  </div>
                                  <button 
                                      onClick={requestCameraPermission}
                                      className="text-xs text-blue-400 hover:text-white underline decoration-blue-500/50 hover:decoration-white"
                                  >
                                      INITIALIZE SENSORS MANUALLY
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {gameStatus === GameStatus.GAME_OVER && (
                       <div className="flex flex-col items-center gap-6 animate-pop">
                           <h2 className="text-6xl font-black text-red-500 tracking-widest drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                               SYNC FAILED
                           </h2>
                           <div className="text-2xl text-slate-300 font-mono">
                               SCORE: {score.toLocaleString()}
                           </div>
                           <button 
                              onClick={retryGame}
                              className="px-8 py-4 bg-white text-black font-black text-xl hover:bg-gray-200 rounded-lg flex items-center gap-2"
                           >
                               <RefreshCw size={24} />
                               REBOOT SYSTEM
                           </button>
                           <button onClick={() => setGameStatus(GameStatus.IDLE)} className="text-slate-500 hover:text-white mt-4">
                               RETURN TO LOBBY
                           </button>
                       </div>
                  )}

                  {gameStatus === GameStatus.VICTORY && (
                       <div className="flex flex-col items-center gap-6 animate-pop">
                           <h2 className="text-6xl font-black text-green-400 tracking-widest drop-shadow-[0_0_30px_rgba(74,222,128,0.6)]">
                               COURSE CLEARED
                           </h2>
                           <div className="text-2xl text-slate-300 font-mono">
                               FINAL SCORE: {score.toLocaleString()}
                           </div>
                           <button onClick={() => setGameStatus(GameStatus.IDLE)} className="px-8 py-4 bg-green-500 text-black font-black text-xl hover:bg-green-400 rounded-lg">
                               CONTINUE
                           </button>
                       </div>
                  )}
              </div>

              {/* SHOP MODAL */}
              {showShop && (
                  <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl p-8 flex flex-col pointer-events-auto animate-fadeIn">
                      <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                          <h2 className="text-4xl font-black italic flex items-center gap-4">
                              <ShoppingBag className="text-blue-500" size={32} />
                              ARMORY
                          </h2>
                          <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-yellow-400 text-xl font-bold bg-yellow-400/10 px-4 py-2 rounded-lg">
                                  <Coins />
                                  {coins.toLocaleString()}
                              </div>
                              <button onClick={() => setShowShop(false)} className="p-2 hover:bg-white/10 rounded-full">
                                  <ArrowLeft size={32} />
                              </button>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto pb-20">
                          {SABER_CATALOG.filter(item => item.id !== 'ultimate_eudin' || isAdmin).map((item) => {
                              const owned = inventory.includes(item.id);
                              const equipped = equippedSaberId === item.id;
                              
                              return (
                                  <div key={item.id} className={`relative p-4 rounded-xl border transition-all group ${
                                      equipped ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 
                                      owned ? 'bg-slate-800/40 border-slate-700 hover:border-slate-500' : 
                                      'bg-black/40 border-slate-800 opacity-80 hover:opacity-100 hover:border-slate-600'
                                  }`}>
                                      <div className="aspect-square bg-gradient-to-br from-slate-800 to-black rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                                          {/* Render a mini preview or icon */}
                                          <div className={`w-32 h-2 rounded-full rotate-45 shadow-[0_0_15px_currentColor] ${equipped ? 'text-blue-400' : 'text-slate-400'}`} style={{ backgroundColor: 'currentColor' }} />
                                          {item.id === 'ultimate_eudin' && <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />}
                                      </div>
                                      
                                      <div className="flex justify-between items-start mb-2">
                                          <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                                          {equipped && <div className="bg-blue-500 text-[10px] px-2 py-0.5 rounded font-bold">EQUIPPED</div>}
                                      </div>
                                      
                                      <p className="text-xs text-slate-400 mb-4 h-8 leading-tight">{item.description}</p>
                                      
                                      <div className="space-y-1 mb-4 text-xs font-mono">
                                          <div className="flex justify-between">
                                              <span className="text-slate-500">SCORE</span>
                                              <span className={item.perks.scoreMult >= 1 ? 'text-green-400' : 'text-red-400'}>x{item.perks.scoreMult}</span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-slate-500">COINS</span>
                                              <span className={item.perks.coinMult >= 1 ? 'text-green-400' : 'text-red-400'}>x{item.perks.coinMult}</span>
                                          </div>
                                      </div>

                                      {owned ? (
                                          <button 
                                              onClick={() => buyItem(item)}
                                              disabled={equipped}
                                              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                                                  equipped ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-white text-black hover:bg-blue-50'
                                              }`}
                                          >
                                              {equipped ? <Check size={16} /> : 'EQUIP'}
                                          </button>
                                      ) : (
                                          <button 
                                              onClick={() => buyItem(item)}
                                              disabled={coins < item.price}
                                              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                                                  coins >= item.price ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                              }`}
                                          >
                                              {coins >= item.price ? (
                                                  <>BUY <span className="text-xs bg-black/20 px-1.5 rounded">{item.price}</span></>
                                              ) : (
                                                  <>LOCKED <Lock size={14} /></>
                                              )}
                                          </button>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* BOTTOM HUD (Health) */}
              {gameStatus === GameStatus.PLAYING && (
                  <div className={`fixed bottom-0 left-0 w-full h-2 pointer-events-none transition-colors duration-300 ${damageAnim ? 'bg-red-500' : 'bg-blue-900/30'}`}>
                      <div 
                        className={`h-full shadow-[0_0_20px_currentColor] transition-all duration-300 ${health < 30 ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`} 
                        style={{ width: `${health}%` }} 
                      />
                  </div>
              )}

              {/* Level Up Overlay */}
              {showLevelUp && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/80 backdrop-blur border border-yellow-500 p-8 rounded-2xl text-center animate-level-up">
                          <div className="text-yellow-400 font-bold text-xl mb-2">LEVEL UP!</div>
                          <div className="text-6xl font-black text-white">{level}</div>
                      </div>
                  </div>
              )}
          