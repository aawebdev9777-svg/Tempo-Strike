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
import { Play, RefreshCw, VideoOff, ShoppingBag, Lock, Check, Coins, ArrowLeft, TrendingUp, Zap, Camera, Disc, Activity, Power, Shield, User, ChevronRight, Key, Trash2, Database, LogOut, Users, Eye, EyeOff } from 'lucide-react';

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
  
  // Hand Tracking Hook
  const { isCameraReady, handPositionsRef, lastResultsRef, error: cameraError, requestCameraPermission } = useMediaPipe(videoRef);

  // Derived Stats
  const level = useMemo(() => Math.floor(Math.sqrt(xp / 100)) + 1, [xp]);
  const progressToNextLevel = useMemo(() => {
      const currentLevelBase = (level - 1) * (level - 1) * 100;
      const nextLevelBase = level * level * 100;
      return ((xp - currentLevelBase) / (nextLevelBase - currentLevelBase)) * 100;
  }, [xp, level]);

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
     }

     setScore(s => s + (points * multiplier));
     setHealth(h => Math.min(100, Math.max(0, h + healthBonus)));
     setCoins(c => c + coinReward);
     setXp(x => x + (points / 5)); 

  }, [multiplier, equippedItem, diffConfig]);

  const handleNoteMiss = useCallback((note: NoteData) => {
      setCombo(0);
      setMultiplier(1);
      setHealth(h => {
          const newHealth = h - diffConfig.healthDrain; 
          if (newHealth <= 0) {
             // Defer game over to avoid state clash during render
             setTimeout(() => endGame(false), 0);
             return 0;
          }
          return newHealth;
      });
  }, [diffConfig]);

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

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      const user = loginInput.trim().toUpperCase();
      const pass = passwordInput; // Keep password raw for exact match

      if (!user || !pass) {
          setLoginError("CREDENTIALS REQUIRED");
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
          const savedCoins = localStorage.getItem(`ts_user_${user}_coins`);
          const savedInv = localStorage.getItem(`ts_user_${user}_inventory`);
          const savedEquip = localStorage.getItem(`ts_user_${user}_equipped`);
          const savedXp = localStorage.getItem(`ts_user_${user}_xp`);

          setCoins(savedCoins ? parseInt(savedCoins, 10) : 0);
          setInventory(savedInv ? JSON.parse(savedInv) : ['default']);
          setEquippedSaberId(savedEquip || 'default');
          setXp(savedXp ? parseInt(savedXp, 10) : 0);
      } else {
          // Register new user
          localStorage.setItem(`ts_user_${user}_auth`, pass);
      }

      setUsername(user);
      enterGame();
  };

  const handleSystemReset = () => {
      if (window.confirm("WARNING: SYSTEM PURGE\n\nThis will permanently delete ALL user accounts and progress.\nAre you sure you want to proceed?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const handleLogout = () => {
      setIsAdmin(false);
      setUsername('');
      setLoginInput('');
      setPasswordInput('');
      setLoginError(null);
      setAllPlayers([]);
  };

  const enterGame = () => {
      setIntroStarted(true);
      // Trigger music buffering early
      if (audioRef.current) {
          audioRef.current.load();
      }
      setGameStatus(GameStatus.IDLE);
  };

  const startGame = async () => {
    if (!isCameraReady) return;
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(100);
    
    // Generate Chart
    const newChart = generateChart(difficulty);
    setActiveChart(newChart);

    try {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
          setGameStatus(GameStatus.PLAYING);
      }
    } catch (e) {
        console.error("Audio play failed", e);
        alert("Audio playback failed. Please interact with the page.");
    }
  };

  const endGame = (victory: boolean) => {
      setGameStatus(victory ? GameStatus.VICTORY : GameStatus.GAME_OVER);
      if (audioRef.current) audioRef.current.pause();
      if (victory) setXp(x => x + 500 * diffConfig.scoreMultiplier);
  };

  const handleShopItemClick = (item: typeof SABER_CATALOG[0]) => {
      if (inventory.includes(item.id)) {
          setEquippedSaberId(item.id);
      } else {
          if (coins >= item.price) {
            setCoins(c => c - item.price);
            setInventory(i => [...i, item.id]);
          }
      }
  };

  // If camera loads while we are stuck in 'loading' state, move to idle (unless we have intro)
  useEffect(() => {
      if (gameStatus === GameStatus.LOADING && isCameraReady && introStarted) {
          setGameStatus(GameStatus.IDLE);
      }
  }, [isCameraReady, gameStatus, introStarted]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none text-white">
      {/* Hidden Video Source */}
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay style={{ width: '640px', height: '480px' }} />

      {/* 3D World Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false, stencil: false, depth: true }}>
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

      {/* Holographic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
      <div className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

      {/* Webcam HUD Preview (Bottom Right) */}
      <WebcamPreview videoRef={videoRef} resultsRef={lastResultsRef} isCameraReady={isCameraReady} />

      {/* --- INITIAL LOGIN / ADMIN SCREEN --- */}
      {!introStarted && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
              <div className="w-full max-w-4xl px-8 animate-in fade-in duration-1000 slide-in-from-bottom-10">
                  
                  {isAdmin ? (
                      /* --- ADMIN DASHBOARD --- */
                      <div className="flex flex-col items-center w-full">
                          <div className="text-center mb-8">
                               <h1 className="text-4xl font-black italic tracking-tighter text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                                   ADMINISTRATION CONSOLE
                               </h1>
                               <div className="flex items-center justify-center gap-2 mt-2 text-red-900 font-mono text-xs tracking-[0.3em] uppercase bg-red-500/10 py-1 px-4 rounded border border-red-500/30">
                                   <Database size={12} /> RESTRICTED ACCESS: LEVEL 5
                               </div>
                          </div>

                          <div className="w-full bg-black/80 border border-red-500/30 rounded-lg overflow-hidden backdrop-blur-md max-h-[60vh] flex flex-col">
                               <div className="grid grid-cols-5 gap-4 p-4 bg-red-900/20 border-b border-red-500/30 font-bold text-red-400 text-sm tracking-widest uppercase">
                                   <div className="flex items-center gap-2"><User size={14}/> Agent ID</div>
                                   <div className="flex items-center gap-2"><TrendingUp size={14}/> Clearance</div>
                                   <div className="flex items-center gap-2"><Coins size={14}/> Credits</div>
                                   <div className="flex items-center gap-2"><Shield size={14}/> Loadout</div>
                                   <div className="flex items-center gap-2"><Activity size={14}/> Progress</div>
                               </div>
                               
                               <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                                   {allPlayers.length === 0 ? (
                                       <div className="text-center p-8 text-gray-500 font-mono">NO RECORDS FOUND</div>
                                   ) : (
                                       allPlayers.map((p, i) => (
                                           <div key={i} className="grid grid-cols-5 gap-4 p-3 border-b border-white/5 hover:bg-white/5 transition-colors items-center text-sm font-mono">
                                               <div className="text-white font-bold">{p.username}</div>
                                               <div className="text-blue-400">LVL {p.level}</div>
                                               <div className="text-yellow-400">{p.coins.toLocaleString()}</div>
                                               <div className="text-gray-400 text-xs">{p.saberName}</div>
                                               <div className="flex items-center pr-2">
                                                   <ActivityChart seed={p.username} />
                                               </div>
                                           </div>
                                       ))
                                   )}
                               </div>
                          </div>

                          <button 
                             onClick={handleLogout}
                             className="mt-8 flex items-center gap-2 px-8 py-3 bg-red-600/20 border border-red-500/50 hover:bg-red-600/40 text-red-100 rounded transition-all tracking-widest font-bold text-sm"
                          >
                              <LogOut size={16} /> TERMINATE SESSION
                          </button>
                      </div>
                  ) : (
                    /* --- LOGIN FORM --- */
                    <div className="max-w-md mx-auto">
                        <div className="text-center mb-10">
                            <h1 className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                TEMPO <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">STRIKE</span>
                            </h1>
                            <div className="flex items-center justify-center gap-2 mt-4 text-blue-400/60 font-mono text-xs tracking-[0.3em] uppercase">
                                <Lock size={12} /> Restricted Access Terminal
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="relative bg-white/5 border border-white/10 p-8 rounded-lg backdrop-blur-sm overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
                            
                            {loginError && (
                                <div className="mb-4 bg-red-900/30 border border-red-500/50 p-2 rounded text-center">
                                    <span className="text-red-400 text-xs font-bold tracking-widest">{loginError}</span>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Username */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">Operative ID</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                        <input 
                                            type="text" 
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            placeholder="ENTER CODENAME"
                                            className="w-full bg-black/50 border border-white/10 rounded px-12 py-4 text-white font-mono placeholder:text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase tracking-wider"
                                            autoFocus
                                            maxLength={12}
                                        />
                                    </div>
                                </div>
                                
                                {/* Password */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">Passcode</label>
                                    <div className="relative group">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-black/50 border border-white/10 rounded px-12 py-4 text-white font-mono placeholder:text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all tracking-wider"
                                            maxLength={20}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-400 transition-colors focus:outline-none"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full group relative py-4 bg-blue-600/20 overflow-hidden rounded border border-blue-500/50 hover:bg-blue-600/40 hover:border-blue-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!loginInput.trim() || !passwordInput}
                                >
                                    <div className="relative flex items-center justify-center gap-3">
                                        <div className="absolute inset-0 bg-blue-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <span className="font-bold tracking-[0.2em] text-blue-100 group-hover:text-white relative z-10 text-sm">AUTHENTICATE</span>
                                        <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform relative z-10" />
                                    </div>
                                </button>
                            </div>
                        </form>
                        
                        <div className="flex justify-between items-center mt-6 px-2">
                            <div className="text-[10px] text-gray-600 font-mono">
                                v2.4.2 | SECURE
                            </div>
                            <button 
                                onClick={handleSystemReset}
                                className="flex items-center gap-1 text-[10px] text-red-900/50 hover:text-red-500 font-mono uppercase tracking-wider transition-colors"
                                title="Delete All Data"
                            >
                                <Trash2 size={10} /> System Purge
                            </button>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      )}

      {/* --- HUD LAYER (Only if intro started and NOT admin) --- */}
      {introStarted && !isAdmin && (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-20">
          
          {/* Top Bar Stats */}
          <div className="flex justify-between items-start w-full pointer-events-auto">
             
             {/* Left: Health & Level */}
             <div className="flex flex-col gap-3 w-64">
                 <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 rounded-lg border-l-2 border-blue-500">
                     <div className="bg-blue-600/20 p-2 rounded text-blue-400 font-bold border border-blue-500/30 flex flex-col items-center justify-center min-w-[3.5rem]">
                        <span className="text-[9px] text-blue-300/70 tracking-tighter uppercase mb-0.5">Level</span>
                        <span className="text-xl leading-none">{level}</span>
                     </div>
                     <div className="flex-1">
                         <div className="flex justify-between items-end mb-1">
                             <div className="text-[10px] font-bold text-gray-300 tracking-wider uppercase">{username}</div>
                             <div className="text-[9px] text-gray-500 font-mono">{Math.floor(progressToNextLevel)}%</div>
                         </div>
                         <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${progressToNextLevel}%` }} />
                         </div>
                     </div>
                 </div>

                 <div className="flex items-center gap-2">
                     <Activity size={16} className={health < 30 ? "text-red-500 animate-pulse" : "text-green-500"} />
                     <div className="flex-1 h-2 bg-gray-900/80 rounded-sm overflow-hidden border border-white/10 skew-x-[-10deg]">
                         <div 
                            className={`h-full transition-all duration-200 ${health > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-red-500'}`} 
                            style={{ width: `${health}%` }} 
                         />
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-2 text-yellow-400 font-mono text-sm">
                     <Coins size={14} /> {coins.toLocaleString()} CR
                 </div>
             </div>

             {/* Center: Score (Only visible when playing/end) */}
             {(gameStatus === GameStatus.PLAYING || gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
                 <div className="absolute left-1/2 -translate-x-1/2 top-4 text-center">
                     <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-lg">
                         {score.toLocaleString()}
                     </h1>
                     {combo > 5 && (
                         <div className="flex flex-col items-center mt-1">
                             <span className={`text-2xl font-bold italic ${combo > 20 ? 'text-blue-400' : 'text-gray-400'} animate-bounce-short`}>
                                 {combo} COMBO
                             </span>
                             {multiplier > 1 && (
                                 <span className="text-xs font-mono text-yellow-500 tracking-widest border border-yellow-500/30 px-2 rounded bg-yellow-500/10">
                                     x{multiplier} MULTIPLIER
                                 </span>
                             )}
                         </div>
                     )}
                 </div>
             )}
             
             {/* Right: Gear */}
             <div className="text-right">
                <div className="bg-black/40 backdrop-blur-md p-3 rounded-lg border-r-2 border-purple-500 inline-block">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Equipped</div>
                    <div className="text-white font-bold text-sm flex items-center justify-end gap-2">
                        {equippedItem.name} <Shield size={14} className="text-purple-400"/>
                    </div>
                </div>
             </div>
          </div>

          {/* --- CENTER SCREENS --- */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              
              {/* LOADING */}
              {gameStatus === GameStatus.LOADING && (
                  <div className="pointer-events-auto bg-black/80 p-8 rounded-none border border-blue-500/30 backdrop-blur-md max-w-md w-full text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan"></div>
                      
                      {cameraError ? (
                          <div className="space-y-4">
                              <div className="text-red-500 border border-red-500/50 bg-red-950/30 p-4 rounded text-sm">
                                  <div className="font-bold flex items-center justify-center gap-2 mb-2"><VideoOff size={16}/> SENSOR ERROR</div>
                                  {cameraError}
                              </div>
                              <button 
                                onClick={requestCameraPermission}
                                className="bg-white text-black px-6 py-2 font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 w-full"
                              >
                                  <Camera size={18} /> ENABLE CAMERA
                              </button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                             <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                             <div className="font-mono text-blue-400 text-sm animate-pulse">
                                 {!isCameraReady ? "CALIBRATING SENSORS..." : "LOADING ASSETS..."}
                             </div>
                          </div>
                      )}
                  </div>
              )}

              {/* MAIN MENU */}
              {gameStatus === GameStatus.IDLE && !showShop && (
                  <div className="pointer-events-auto flex flex-col items-center gap-8 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500">
                      
                      {/* Logo Area */}
                      <div className="text-center relative">
                          <div className="absolute -inset-10 bg-blue-500/10 blur-3xl rounded-full"></div>
                          <h1 className="relative text-8xl font-black italic text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                              TEMPO
                          </h1>
                          <h1 className="relative text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 tracking-tighter -mt-4 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                              STRIKE
                          </h1>
                          <div className="text-blue-400/50 font-mono tracking-[0.5em] text-xs mt-4">
                              WELCOME AGENT {username}
                          </div>
                      </div>
                      
                      {/* Difficulty Selection */}
                      <div className="flex gap-4 p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full">
                          {Object.values(Difficulty).map((d) => (
                              <button
                                  key={d}
                                  onClick={() => setDifficulty(d)}
                                  className={`px-8 py-2 rounded-full font-bold text-sm tracking-wider transition-all duration-300 relative overflow-hidden
                                  ${difficulty === d 
                                      ? (d === Difficulty.IMPOSSIBLE 
                                          ? 'text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.8)] border border-red-500/50' 
                                          : 'text-black shadow-[0_0_20px_rgba(59,130,246,0.6)]') 
                                      : 'text-gray-400 hover:text-white'}`}
                              >
                                  {difficulty === d && (
                                      <div className={`absolute inset-0 ${d === Difficulty.IMPOSSIBLE ? 'bg-red-900/40 animate-pulse' : 'bg-white'}`}></div>
                                  )}
                                  <span className="relative z-10">{DIFFICULTY_CONFIG[d].label}</span>
                              </button>
                          ))}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-4 w-full max-w-sm relative z-10">
                          {!isCameraReady ? (
                               <div className="bg-red-900/20 border border-red-500/50 p-4 rounded text-center text-red-300 text-sm backdrop-blur-md">
                                   <div className="flex items-center justify-center gap-2 font-bold mb-2"><VideoOff size={16} /> CAMERA OFFLINE</div>
                                   {cameraError && (
                                       <button onClick={requestCameraPermission} className="underline hover:text-white">Retry Permission</button>
                                   )}
                               </div>
                          ) : (
                              <>
                                  <button onClick={startGame} className="group relative w-full bg-blue-600 hover:bg-blue-500 text-white h-16 skew-x-[-10deg] transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(37,99,235,0.4)] border border-blue-400">
                                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-shine"></div>
                                      <div className="flex items-center justify-center gap-3 skew-x-[10deg] font-black tracking-widest text-xl">
                                          <Play fill="currentColor" /> INITIATE
                                      </div>
                                  </button>
                                  
                                  <button onClick={() => setShowShop(true)} className="w-full bg-black/50 hover:bg-white/10 text-white h-14 skew-x-[-10deg] border border-white/20 hover:border-white/50 transition-all backdrop-blur-sm">
                                      <div className="flex items-center justify-center gap-3 skew-x-[10deg] font-bold tracking-widest text-sm">
                                          <ShoppingBag size={18} /> ARMORY
                                      </div>
                                  </button>
                              </>
                          )}
                      </div>
                  </div>
              )}

              {/* SHOP INTERFACE */}
              {showShop && (
                  <div className="pointer-events-auto bg-black/90 w-full max-w-6xl h-[85vh] border border-white/10 backdrop-blur-2xl flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                          <ShoppingBag size={300} />
                      </div>

                      <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/50">
                          <div>
                              <h2 className="text-4xl font-black italic tracking-tighter text-white">ARMORY</h2>
                              <p className="text-gray-400 text-sm font-mono mt-1">UPGRADE YOUR ARSENAL</p>
                          </div>
                          <div className="flex items-center gap-6">
                              <div className="text-right">
                                  <div className="text-xs text-gray-500 uppercase">Credits</div>
                                  <div className="text-2xl font-mono text-yellow-400 font-bold flex items-center gap-2 justify-end">
                                      {coins.toLocaleString()} <Coins size={20} />
                                  </div>
                              </div>
                              <button onClick={() => setShowShop(false)} className="bg-white/10 p-3 hover:bg-white/20 transition-colors rounded-full">
                                  <ArrowLeft />
                              </button>
                          </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar">
                          {SABER_CATALOG.map(item => {
                              const isOwned = inventory.includes(item.id);
                              const isEquipped = equippedSaberId === item.id;
                              const canAfford = coins >= item.price;
                              const isSecret = item.id === 'ultimate_eudin';

                              return (
                                  <div key={item.id} 
                                       onClick={() => !isOwned && isSecret && handleShopItemClick(item)}
                                       className={`group relative p-6 border transition-all duration-300 flex flex-col
                                       ${isEquipped ? 'border-blue-500 bg-blue-900/10' : 
                                         isSecret && !isOwned ? 'border-purple-500/30 bg-purple-900/5 hover:border-purple-500/60' : 
                                         'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'}
                                       `}
                                  >
                                      <div className="flex-1">
                                          <div className="flex justify-between items-start mb-4">
                                              <h3 className={`text-xl font-bold ${isSecret ? 'text-purple-300' : 'text-white'}`}>{item.name}</h3>
                                              {isEquipped && <Check size={20} className="text-blue-500" />}
                                          </div>
                                          
                                          <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                                              <div className="bg-black/30 p-2 rounded">
                                                  <TrendingUp size={14} className="mx-auto text-green-400 mb-1"/>
                                                  <div className="text-[10px] text-gray-500">SCORE</div>
                                                  <div className="font-mono text-white text-sm">x{item.perks.scoreMult}</div>
                                              </div>
                                              <div className="bg-black/30 p-2 rounded">
                                                  <Coins size={14} className="mx-auto text-yellow-400 mb-1"/>
                                                  <div className="text-[10px] text-gray-500">COIN</div>
                                                  <div className="font-mono text-white text-sm">x{item.perks.coinMult}</div>
                                              </div>
                                              <div className="bg-black/30 p-2 rounded">
                                                  <Zap size={14} className="mx-auto text-blue-400 mb-1"/>
                                                  <div className="text-[10px] text-gray-500">AREA</div>
                                                  <div className="font-mono text-white text-sm">x{item.perks.hitWindow}</div>
                                              </div>
                                          </div>
                                          <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
                                      </div>

                                      <div className="mt-6">
                                          {isOwned ? (
                                              <button 
                                                  onClick={() => handleShopItemClick(item)}
                                                  disabled={isEquipped}
                                                  className={`w-full py-3 font-bold text-sm tracking-widest uppercase transition-all
                                                  ${isEquipped ? 'bg-green-500/20 text-green-500 cursor-default border border-green-500/50' : 'bg-white text-black hover:bg-gray-200'}`}
                                              >
                                                  {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                              </button>
                                          ) : (
                                              <button 
                                                  onClick={() => handleShopItemClick(item)}
                                                  className={`w-full py-3 font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2
                                                  ${canAfford ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                                              >
                                                  {canAfford ? (
                                                      <>PURCHASE <span className="text-xs bg-black/20 px-1 rounded ml-1">{item.price}</span></>
                                                  ) : (
                                                      <><Lock size={14} /> {item.price}</>
                                                  )}
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* END SCREEN */}
              {(gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
                  <div className="pointer-events-auto text-center space-y-6 animate-in zoom-in-90 duration-300">
                      <div>
                          <h2 className={`text-8xl font-black italic tracking-tighter ${gameStatus === GameStatus.VICTORY ? 'text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.5)]' : 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]'}`}>
                              {gameStatus === GameStatus.VICTORY ? "CLEARED" : "FAILED"}
                          </h2>
                          <div className="h-2 w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-50 mt-2"></div>
                      </div>
                      
                      <div className="bg-black/60 backdrop-blur-xl p-8 border border-white/10 min-w-[400px]">
                          <div className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Final Score</div>
                          <div className="text-6xl font-black text-white mb-6">{score.toLocaleString()}</div>
                          
                          {gameStatus === GameStatus.VICTORY && (
                              <div className="inline-block bg-yellow-500/20 border border-yellow-500/50 px-4 py-1 rounded text-yellow-400 text-sm font-bold mb-6">
                                  +500 XP BONUS
                              </div>
                          )}
                          
                          <div className="flex gap-4 justify-center">
                              <button onClick={() => { setGameStatus(GameStatus.IDLE); startGame(); }} className="bg-white text-black px-6 py-3 font-bold hover:bg-gray-200 transition-colors">
                                  RETRY
                              </button>
                              <button onClick={() => setGameStatus(GameStatus.IDLE)} className="bg-transparent border border-white/30 text-white px-6 py-3 font-bold hover:bg-white/10 transition-colors">
                                  MENU
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
      )}
    </div>
  );
};

export default App;