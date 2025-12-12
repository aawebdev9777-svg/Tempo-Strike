/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader, useProgress } from '@react-three/drei';
import { GameStatus, NoteData } from './types';
import { DEMO_CHART, SONG_URL, SABER_CATALOG } from './constants';
import { useMediaPipe } from './hooks/useMediaPipe';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import { Play, RefreshCw, VideoOff, Hand, Sparkles, ShoppingBag, Lock, Check, Coins, ArrowLeft, TrendingUp, Zap, Star } from 'lucide-react';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [health, setHealth] = useState(100);
  
  // Economy State
  const [coins, setCoins] = useState<number>(() => {
      const saved = localStorage.getItem('ts_coins');
      return saved ? parseInt(saved, 10) : 0;
  });
  const [inventory, setInventory] = useState<string[]>(() => {
      const saved = localStorage.getItem('ts_inventory');
      return saved ? JSON.parse(saved) : ['default'];
  });
  const [equippedSaberId, setEquippedSaberId] = useState<string>(() => {
      return localStorage.getItem('ts_equipped') || 'default';
  });
  const [xp, setXp] = useState<number>(() => {
      return parseInt(localStorage.getItem('ts_xp') || '0', 10);
  });

  const [showShop, setShowShop] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(new Audio(SONG_URL));
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { isCameraReady, handPositionsRef, lastResultsRef, error: cameraError } = useMediaPipe(videoRef);

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

  // Persist Data
  useEffect(() => { localStorage.setItem('ts_coins', coins.toString()); }, [coins]);
  useEffect(() => { localStorage.setItem('ts_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('ts_equipped', equippedSaberId); }, [equippedSaberId]);
  useEffect(() => { localStorage.setItem('ts_xp', xp.toString()); }, [xp]);

  // Game Logic Handlers
  const handleNoteHit = useCallback((note: NoteData, goodCut: boolean) => {
     let points = 100;
     let coinReward = 10;
     
     if (goodCut) {
         points += 50;
         coinReward += 5;
     }

     // Apply Perks
     points = Math.round(points * equippedItem.perks.scoreMult);
     coinReward = Math.round(coinReward * equippedItem.perks.coinMult);

     // Haptic feedback
     if (navigator.vibrate) navigator.vibrate(goodCut ? 40 : 20);

     setCombo(c => {
       const newCombo = c + 1;
       if (newCombo > 30) setMultiplier(8);
       else if (newCombo > 20) setMultiplier(4);
       else if (newCombo > 10) setMultiplier(2);
       else setMultiplier(1);
       return newCombo;
     });

     setScore(s => s + (points * multiplier));
     setHealth(h => Math.min(100, h + 2));
     setCoins(c => c + coinReward);
     setXp(x => x + 25); // Gain XP per hit

  }, [multiplier, equippedItem]);

  const handleNoteMiss = useCallback((note: NoteData) => {
      setCombo(0);
      setMultiplier(1);
      setHealth(h => {
          const newHealth = h - 15;
          if (newHealth <= 0) {
             setTimeout(() => endGame(false), 0);
             return 0;
          }
          return newHealth;
      });
  }, []);

  const startGame = async () => {
    if (!isCameraReady) return;
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(100);
    DEMO_CHART.forEach(n => { n.hit = false; n.missed = false; });
    try {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
          setGameStatus(GameStatus.PLAYING);
      }
    } catch (e) {
        console.error("Audio play failed", e);
        alert("Could not start audio.");
    }
  };

  const endGame = (victory: boolean) => {
      setGameStatus(victory ? GameStatus.VICTORY : GameStatus.GAME_OVER);
      if (audioRef.current) audioRef.current.pause();
      if (victory) setXp(x => x + 500); // Victory XP Bonus
  };

  const handleShopItemClick = (item: typeof SABER_CATALOG[0]) => {
      if (inventory.includes(item.id)) {
          setEquippedSaberId(item.id);
      } else {
          if (item.id === 'ultimate_eudin') {
             const newClicks = secretClicks + 1;
             setSecretClicks(newClicks);
             if (newClicks >= 4) {
                 setInventory(i => [...i, item.id]);
                 setEquippedSaberId(item.id);
                 setCoins(c => c + 1000);
                 setSecretClicks(0);
                 alert("ULTIMATE SABER UNLOCKED!");
                 return;
             }
          }
          if (coins >= item.price) {
            setCoins(c => c - item.price);
            setInventory(i => [...i, item.id]);
          }
      }
  };

  useEffect(() => {
      if (gameStatus === GameStatus.LOADING && isCameraReady) setGameStatus(GameStatus.IDLE);
  }, [isCameraReady, gameStatus]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay style={{ width: '640px', height: '480px' }} />

      <Canvas shadows dpr={[1, 2]}>
          {gameStatus !== GameStatus.LOADING && (
             <GameScene 
                gameStatus={gameStatus}
                audioRef={audioRef}
                handPositionsRef={handPositionsRef}
                chart={DEMO_CHART}
                onNoteHit={handleNoteHit}
                onNoteMiss={handleNoteMiss}
                onSongEnd={() => endGame(true)}
                equippedSaber={equippedItem}
                combo={combo}
             />
          )}
      </Canvas>

      <WebcamPreview videoRef={videoRef} resultsRef={lastResultsRef} isCameraReady={isCameraReady} />

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
          
          {/* HUD (Top) */}
          <div className="flex justify-between items-start text-white w-full pointer-events-auto">
             
             {/* Player Stats / Health */}
             <div className="w-1/3 max-w-xs space-y-3">
                 
                 {/* Level Display */}
                 <div className="bg-gray-900/80 p-2 rounded-xl border border-gray-700 backdrop-blur-md flex items-center gap-3">
                     <div className="bg-blue-600 text-white font-bold w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-lg shadow-blue-500/30">
                         {level}
                     </div>
                     <div className="flex-1">
                         <div className="text-xs text-blue-300 font-bold mb-1 uppercase tracking-wider">Player Level</div>
                         <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressToNextLevel}%` }} />
                         </div>
                     </div>
                 </div>

                 <div className="h-5 bg-gray-900 rounded-full overflow-hidden border border-gray-600 shadow-inner">
                     <div className={`h-full transition-all duration-300 ease-out ${health > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-500'}`} style={{ width: `${health}%` }} />
                 </div>
                 
                 <div className="flex items-center gap-2 text-yellow-400 bg-black/60 px-4 py-2 rounded-full w-fit backdrop-blur-sm border border-yellow-500/30 shadow-lg">
                     <Coins size={18} fill="currentColor" />
                     <span className="font-bold text-lg">{coins.toLocaleString()}</span>
                 </div>
             </div>

             {/* Score */}
             <div className="text-center">
                 <h1 className="text-6xl font-black italic tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] stroke-black">
                     {score.toLocaleString()}
                 </h1>
                 <div className="mt-2 flex flex-col items-center">
                     <p className={`text-3xl font-bold ${combo > 10 ? 'text-blue-400 scale-110 drop-shadow-glow' : 'text-gray-400'} transition-all`}>
                         {combo}x COMBO
                     </p>
                     {multiplier > 1 && (
                         <span className="text-sm px-3 py-1 bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-500/50 rounded-full mt-2 animate-pulse font-mono tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                             MULTIPLIER {multiplier}X
                         </span>
                     )}
                 </div>
             </div>
             
             <div className="w-1/3 flex justify-end">
                {/* Active Saber Perks Display */}
                <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700 backdrop-blur-sm text-right">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">Current Gear</div>
                    <div className="text-white font-bold text-sm mb-1">{equippedItem.name}</div>
                    <div className="flex gap-3 justify-end text-xs">
                        <span className="flex items-center gap-1 text-green-400"><TrendingUp size={12}/> x{equippedItem.perks.scoreMult} Score</span>
                        <span className="flex items-center gap-1 text-yellow-400"><Coins size={12}/> x{equippedItem.perks.coinMult} Coin</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Center Screens */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              
              {gameStatus === GameStatus.LOADING && (
                  <div className="pointer-events-auto bg-black/80 p-10 rounded-2xl flex flex-col items-center border border-blue-900/50 backdrop-blur-md">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-6"></div>
                      <h2 className="text-2xl text-white font-bold mb-2">System Boot</h2>
                      <p className="text-blue-300">{!isCameraReady ? "Aligning Sensors..." : "Loading Assets..."}</p>
                  </div>
              )}

              {gameStatus === GameStatus.IDLE && !showShop && (
                  <div className="pointer-events-auto bg-black/80 p-12 rounded-3xl text-center border-2 border-blue-500/30 backdrop-blur-xl max-w-lg shadow-[0_0_50px_rgba(37,99,235,0.3)]">
                      <div className="mb-6 flex justify-center">
                         <Sparkles className="w-20 h-20 text-blue-500 animate-pulse" />
                      </div>
                      <h1 className="text-7xl font-black text-white mb-2 tracking-tighter italic drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]">
                          TEMPO <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">STRIKE</span>
                      </h1>
                      <div className="text-blue-200/50 font-mono mb-8 tracking-[0.5em] text-sm">RHYTHM ACTION</div>
                      
                      {!isCameraReady ? (
                           <div className="flex items-center justify-center text-red-400 gap-2 bg-red-900/20 p-4 rounded-lg animate-pulse border border-red-900/50">
                               <VideoOff /> Camera Offline
                           </div>
                      ) : (
                          <div className="flex flex-col gap-4">
                              <button onClick={startGame} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xl font-bold py-5 px-12 rounded-2xl transition-all transform hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] flex items-center justify-center gap-3 w-full shadow-lg border border-blue-400/20">
                                  <Play fill="currentColor" /> INITIATE
                              </button>
                              
                              <button onClick={() => setShowShop(true)} className="bg-gray-800 hover:bg-gray-700 text-white text-lg font-bold py-4 px-12 rounded-2xl transition-all border border-gray-600 flex items-center justify-center gap-3 w-full hover:border-gray-500">
                                  <ShoppingBag /> ARMORY
                              </button>
                          </div>
                      )}
                  </div>
              )}

              {/* SHOP MENU */}
              {showShop && (
                  <div className="pointer-events-auto bg-gray-950/95 p-8 rounded-3xl w-full max-w-5xl border border-gray-800 backdrop-blur-xl h-[85vh] flex flex-col shadow-2xl">
                      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                          <h2 className="text-3xl text-white font-bold flex items-center gap-3 tracking-tight">
                              <ShoppingBag className="text-blue-500" /> ARMORY
                          </h2>
                          <div className="flex items-center gap-4">
                              <div className="bg-black/60 px-5 py-2 rounded-xl border border-yellow-500/20 text-yellow-400 font-mono text-xl flex items-center gap-2">
                                  <Coins size={20} /> {coins.toLocaleString()}
                              </div>
                              <button onClick={() => setShowShop(false)} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full text-white transition-colors">
                                  <ArrowLeft size={24} />
                              </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-2 pr-4 custom-scrollbar">
                          {SABER_CATALOG.map(item => {
                              const isOwned = inventory.includes(item.id);
                              const isEquipped = equippedSaberId === item.id;
                              const canAfford = coins >= item.price;
                              const isSecret = item.id === 'ultimate_eudin';

                              return (
                                  <div key={item.id} 
                                       className={`relative p-5 rounded-2xl border-2 flex flex-col justify-between group hover:shadow-xl transition-all duration-300
                                       ${isEquipped ? 'border-blue-500 bg-blue-950/30' : 
                                         isSecret && !isOwned ? 'border-purple-500/30 bg-purple-900/10 hover:border-purple-500/60' : 
                                         'border-gray-800 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800'}`}
                                       onClick={() => !isOwned && isSecret && handleShopItemClick(item)}
                                  >
                                      <div>
                                          <div className="flex justify-between items-start mb-2">
                                              <h3 className={`text-xl font-bold ${isSecret ? 'text-purple-300 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]' : 'text-white'}`}>{item.name}</h3>
                                              {isEquipped && <div className="bg-blue-500 rounded-full p-1"><Check size={14} className="text-white" /></div>}
                                          </div>
                                          <p className="text-gray-400 text-sm mb-4 h-10 leading-snug">{item.description}</p>
                                          
                                          {/* Stats Grid */}
                                          <div className="grid grid-cols-3 gap-2 mb-4">
                                              <div className="bg-black/40 rounded p-2 text-center border border-white/5">
                                                  <TrendingUp size={14} className="mx-auto text-green-400 mb-1"/>
                                                  <div className="text-xs text-gray-500">Score</div>
                                                  <div className="font-mono text-green-400 font-bold">x{item.perks.scoreMult}</div>
                                              </div>
                                              <div className="bg-black/40 rounded p-2 text-center border border-white/5">
                                                  <Coins size={14} className="mx-auto text-yellow-400 mb-1"/>
                                                  <div className="text-xs text-gray-500">Coin</div>
                                                  <div className="font-mono text-yellow-400 font-bold">x{item.perks.coinMult}</div>
                                              </div>
                                              <div className="bg-black/40 rounded p-2 text-center border border-white/5">
                                                  <Zap size={14} className="mx-auto text-blue-400 mb-1"/>
                                                  <div className="text-xs text-gray-500">Hit Area</div>
                                                  <div className="font-mono text-blue-400 font-bold">x{item.perks.hitWindow}</div>
                                              </div>
                                          </div>
                                      </div>
                                      
                                      <div className="mt-2">
                                          {isOwned ? (
                                              <button 
                                                  onClick={() => handleShopItemClick(item)}
                                                  disabled={isEquipped}
                                                  className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${isEquipped ? 'bg-green-500/10 text-green-500 border border-green-500/30 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
                                              >
                                                  {isEquipped ? 'Active' : 'Equip'}
                                              </button>
                                          ) : (
                                              <button 
                                                  onClick={() => handleShopItemClick(item)}
                                                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                                              >
                                                  {canAfford ? (
                                                      <>BUY <span className="bg-black/30 px-2 py-0.5 rounded text-sm">{item.price}</span></>
                                                  ) : (
                                                      <><Lock size={16} /> {item.price}</>
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

              {(gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
                  <div className="pointer-events-auto bg-black/90 p-12 rounded-3xl text-center border-2 border-white/10 backdrop-blur-xl shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                      <h2 className={`text-6xl font-black italic mb-4 tracking-tighter ${gameStatus === GameStatus.VICTORY ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300' : 'text-red-500'}`}>
                          {gameStatus === GameStatus.VICTORY ? "STAGE CLEARED" : "SYSTEM FAILURE"}
                      </h2>
                      <div className="text-white text-4xl mb-2 font-bold">{score.toLocaleString()} PTS</div>
                      {gameStatus === GameStatus.VICTORY && <div className="text-yellow-400 mb-8 font-mono text-lg">+500 XP BONUS</div>}
                      
                      <button onClick={() => setGameStatus(GameStatus.IDLE)} className="bg-white/10 hover:bg-white/20 text-white text-xl py-4 px-10 rounded-full flex items-center justify-center mx-auto gap-2 transition-colors border border-white/10">
                          <RefreshCw /> RETURN TO HUB
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default App;