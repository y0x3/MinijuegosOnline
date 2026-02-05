"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ref, set, onValue, update, get, remove } from 'firebase/database';
import { database } from '../utils/firebase';
import { useArtistVerification } from '../hooks/useArtistVerification';
import MenuScreen from './MenuScreen';
import LobbyScreen from './LobbyScreen';
import GameScreen from './GameScreen';
import EndScreen from './EndScreen';
import '../styles/musicBattle.css';
// ⭐ NUEVO: Importar funciones de limpieza
import { startRoomCleanupInterval } from '../utils/roomCleanup';

const MusicBattleGame = () => {
  const router = useRouter();
  
  // Estados principales
  const [screen, setScreen] = useState('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomData, setRoomData] = useState(null);
  
  
  // Configuración
  const [genre, setGenre] = useState('rock');
  const [turnTime, setTurnTime] = useState(30);
  const [artistType, setArtistType] = useState('both'); // ⭐ NUEVO
  
  // Estado del juego
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [artistInput, setArtistInput] = useState('');
  const [usedArtists, setUsedArtists] = useState([]);
  const [message, setMessage] = useState('');
  const [gameEnding, setGameEnding] = useState(false);
  
  // Sistema anti-trampa
  const [player1Strikes, setPlayer1Strikes] = useState(0);
  const [player2Strikes, setPlayer2Strikes] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [tabChangeTime, setTabChangeTime] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [awayCountdown, setAwayCountdown] = useState(3);
  
  // Sistema de verificación de salas
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showRoomsList, setShowRoomsList] = useState(false);
  const [checkingRooms, setCheckingRooms] = useState(false);
  
  // Sistema de revancha
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchCountdown, setRematchCountdown] = useState(60);
  
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const deleteTimerRef = useRef(null);
  const rematchTimerRef = useRef(null);
  // ⭐ NUEVO: Ref para el sistema de limpieza
  const cleanupIntervalRef = useRef(null);

  // Hook de verificación
  const { verifyArtist, isVerifying } = useArtistVerification(genre, usedArtists, artistType); // ⭐ MODIFICADO: agregado artistType

  // ========================================
  // ⭐ NUEVO: Sistema de limpieza automática
  // ========================================
  useEffect(() => {
    if (database) {
      // Iniciar limpieza cada 5 minutos, eliminar salas inactivas por 10 minutos, máximo 20 salas
      cleanupIntervalRef.current = startRoomCleanupInterval(database, 5, 10, 20);
    }

    return () => {
      // Limpiar interval cuando se desmonta el componente
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [database]);

  // ========================================
  // FUNCIONES
  // ========================================
  
  const checkAvailableRooms = async () => {
    if (!database) return;
    
    setCheckingRooms(true);
    try {
      const roomsRef = ref(database, 'rooms');
      const snapshot = await get(roomsRef);
      
      if (!snapshot.exists()) {
        setAvailableRooms([]);
        setShowRoomsList(true);
        setCheckingRooms(false);
        return;
      }
      
      const rooms = snapshot.val();
      const available = [];
      
      Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        if (room.status === 'waiting' && !room.player2) {
          available.push({
            code: room.code,
            host: room.player1,
            genre: room.genre,
            turnTime: room.turnTime,
            artistType: room.artistType || 'both', // ⭐ NUEVO
            createdAt: room.createdAt
          });
        }
      });
      
      available.sort((a, b) => b.createdAt - a.createdAt);
      
      setAvailableRooms(available);
      setShowRoomsList(true);
    } catch (error) {
      console.error('Error checking rooms:', error);
      setAvailableRooms([]);
    } finally {
      setCheckingRooms(false);
    }
  };

  const joinRoomFromList = async (code) => {
    if (!playerName.trim()) {
      alert('Ingresa tu nombre primero');
      return;
    }
    
    setRoomCode(code);
    setShowRoomsList(false);
    
    setTimeout(() => joinRoom(code), 100);
  };

  const scheduleRoomDeletion = (roomCode, hasRematch = false) => {
    const deleteDelay = hasRematch ? 30000 : 10000;
    
    deleteTimerRef.current = setTimeout(async () => {
      if (database && roomCode) {
        try {
          const roomRef = ref(database, `rooms/${roomCode}`);
          const snapshot = await get(roomRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.status === 'ended' && !data.rematchAccepted) {
              await remove(roomRef);
              console.log(`Sala ${roomCode} eliminada automáticamente`);
            }
          }
        } catch (error) {
          console.error('Error al eliminar sala:', error);
        }
      }
    }, deleteDelay);
  };

  // ⭐ MODIFICADO: Agregado lastActivity y artistType
  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Ingresa tu nombre');
      return;
    }
    
    if (!database) {
      alert('Error: Firebase no configurado');
      return;
    }

    // ⭐ NUEVO: Verificar límite de salas antes de crear
    try {
      const roomsRef = ref(database, 'rooms');
      const snapshot = await get(roomsRef);
      
      if (snapshot.exists()) {
        const rooms = snapshot.val();
        const roomCount = Object.keys(rooms).length;
        
        if (roomCount >= 20) {
          alert('⚠️ Límite de salas alcanzado (20 salas activas). Por favor, intenta de nuevo en unos minutos.');
          return;
        }
      }
    } catch (error) {
      console.error('Error verificando límite de salas:', error);
    }
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = ref(database, `rooms/${code}`);
    
    await set(roomRef, {
      code,
      host: playerName,
      player1: playerName,
      player2: null,
      genre,
      turnTime,
      artistType, // ⭐ NUEVO
      currentPlayer: 1,
      timeLeft: turnTime,
      usedArtists: [],
      status: 'waiting',
      message: 'Esperando jugador 2...',
      createdAt: Date.now(),
      lastActivity: Date.now(), // ⭐ NUEVO
      player1Strikes: 0,
      player2Strikes: 0
    });
    
    setCurrentRoom(code);
    setRoomCode(code);
    setScreen('lobby');
  };

  // ⭐ MODIFICADO: Agregado lastActivity y artistType
  const joinRoom = async (codeToJoin = null) => {
    if (!playerName.trim()) {
      alert('Ingresa tu nombre');
      return;
    }
    
    const code = codeToJoin || roomCode;
    
    if (!code.trim()) {
      alert('Ingresa código de sala');
      return;
    }
    
    if (!database) {
      alert('Error: Firebase no configurado');
      return;
    }
    
    const roomRef = ref(database, `rooms/${code.toUpperCase()}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) {
      alert('Sala no encontrada');
      return;
    }
    
    const room = snapshot.val();
    
    if (room.player2) {
      alert('Sala llena');
      return;
    }
    
    await update(roomRef, {
      player2: playerName,
      status: 'playing',
      message: `¡${room.player1} comienza!`,
      lastActivity: Date.now() // ⭐ NUEVO
    });
    
    setCurrentRoom(code.toUpperCase());
    setGenre(room.genre);
    setTurnTime(room.turnTime);
    setArtistType(room.artistType || 'both'); // ⭐ NUEVO
    setScreen('playing');
  };

  // ⭐ MODIFICADO: Agregado lastActivity
  const handleTimeUp = async () => {
    if (!currentRoom || !roomData || !database) return;
    if (roomData.status === 'ended' || gameEnding) return;
    
    setGameEnding(true);
    
    const loser = currentPlayer === 1 ? roomData.player1 : roomData.player2;
    const winner = currentPlayer === 1 ? roomData.player2 : roomData.player1;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setTimeLeft(0);
    
    try {
      await update(ref(database, `rooms/${currentRoom}`), {
        status: 'ended',
        winner,
        timeLeft: 0,
        message: `⏱️ Tiempo agotado. ${loser} pierde`,
        lastActivity: Date.now() // ⭐ NUEVO
      });
    } catch (error) {
      console.error('Error al actualizar Firebase:', error);
      setGameEnding(false);
    }
  };

  // ⭐ MODIFICADO: Agregado lastActivity en ambos updates
  const handleSubmit = async () => {
    const nameToVerify = artistInput.trim();
    
    if (!nameToVerify) {
      setMessage('Escribe un artista');
      return;
    }
    
    const result = await verifyArtist(nameToVerify);

    if (result.valid && database) {
      const newUsedArtists = [...usedArtists, result.artistName];
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      const nextPlayerName = nextPlayer === 1 ? roomData.player1 : roomData.player2;
      
      await update(ref(database, `rooms/${currentRoom}`), {
        usedArtists: newUsedArtists,
        currentPlayer: nextPlayer,
        timeLeft: turnTime,
        message: `✓ ${result.artistName}! Turno: ${nextPlayerName}`,
        lastActivity: Date.now() // ⭐ NUEVO
      });
      
      setArtistInput('');
      
    } else if (database) {
      const loserName = currentPlayer === 1 ? roomData.player1 : roomData.player2;
      const winnerName = currentPlayer === 1 ? roomData.player2 : roomData.player1;
      
      await update(ref(database, `rooms/${currentRoom}`), {
        status: 'ended',
        winner: winnerName,
        message: `${result.reason}. ${loserName} pierde`,
        lastActivity: Date.now() // ⭐ NUEVO
      });
    }
  };

  const leaveRoom = async () => {
    if (currentRoom && database) {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      await remove(ref(database, `rooms/${currentRoom}`));
    }
    setCurrentRoom(null);
    setRoomCode('');
    setScreen('menu');
    setRoomData(null);
  };

  const goToHome = () => {
    router.push('/');
  };

  // ========================================
  // SISTEMA DE REVANCHA
  // ========================================
  
  // ⭐ MODIFICADO: Agregado lastActivity
  const requestRematch = async () => {
    if (!database || !currentRoom || !roomData) return;
    
    const isPlayer1 = playerName === roomData.player1;
    const rematchField = isPlayer1 ? 'player1Rematch' : 'player2Rematch';
    
    setRematchRequested(true);
    
    await update(ref(database, `rooms/${currentRoom}`), {
      [rematchField]: true,
      message: `${playerName} quiere revancha!`,
      lastActivity: Date.now() // ⭐ NUEVO
    });
  };

  const declineRematch = async () => {
    if (!database || !currentRoom) return;
    
    await update(ref(database, `rooms/${currentRoom}`), {
      message: `${playerName} rechazó la revancha`,
      rematchDeclined: true,
      lastActivity: Date.now() // ⭐ NUEVO
    });
    
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
    }
    
    await remove(ref(database, `rooms/${currentRoom}`));
    
    setCurrentRoom(null);
    setRoomCode('');
    setScreen('menu');
    setRoomData(null);
  };

  // ⭐ MODIFICADO: Agregado lastActivity
  const startRematch = async () => {
    if (!database || !currentRoom || !roomData) return;
    
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
    }
    
    await update(ref(database, `rooms/${currentRoom}`), {
      status: 'playing',
      currentPlayer: 1,
      timeLeft: roomData.turnTime,
      usedArtists: [],
      message: `¡Revancha! ${roomData.player1} comienza`,
      player1Strikes: 0,
      player2Strikes: 0,
      player1Rematch: false,
      player2Rematch: false,
      rematchAccepted: true,
      winner: null,
      lastActivity: Date.now() // ⭐ NUEVO
    });
    
    setUsedArtists([]);
    setCurrentPlayer(1);
    setTimeLeft(roomData.turnTime);
    setPlayer1Strikes(0);
    setPlayer2Strikes(0);
    setRematchRequested(false);
    setRematchCountdown(30);
    setGameEnding(false);
    setScreen('playing');
  };

  // ========================================
  // EFFECTS
  // ========================================
  
  // Timer
  useEffect(() => {
    if (screen !== 'playing' || !roomData || roomData.status === 'ended') {
      return;
    }
    
    if (timeLeft > 0 && isTabVisible) {
      timerRef.current = setTimeout(() => {
        const newTime = timeLeft - 1;
        setTimeLeft(newTime);
        
        if (currentRoom && database && newTime > 0) {
          update(ref(database, `rooms/${currentRoom}`), { 
            timeLeft: newTime,
            lastActivity: Date.now() // ⭐ NUEVO
          });
        } else if (newTime === 0) {
          handleTimeUp();
        }
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeLeft, screen, roomData, isTabVisible, currentRoom, database]);

  // ⭐ MODIFICADO: Agregado lastActivity en TODOS los updates del anti-cheat
  useEffect(() => {
    if (screen !== 'playing') return;

    let awayTimeout = null;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setIsTabVisible(false);
        setTabChangeTime(Date.now());
        setShowWarning(true);
        setAwayCountdown(3);
        
        const isPlayer1 = playerName === roomData?.player1;
        const isPlayer2 = playerName === roomData?.player2;
        
        if (!isPlayer1 && !isPlayer2) return;
        
        if (database && currentRoom) {
          const currentStrikes = isPlayer1 ? player1Strikes : player2Strikes;
          const newStrikes = currentStrikes + 1;
          
          const updateData = isPlayer1 
            ? { player1Strikes: newStrikes }
            : { player2Strikes: newStrikes };
          
          await update(ref(database, `rooms/${currentRoom}`), {
            ...updateData,
            lastActivity: Date.now() // ⭐ NUEVO
          });
          
          const opponentName = isPlayer1 ? roomData.player2 : roomData.player1;
          await update(ref(database, `rooms/${currentRoom}`), {
            message: `⚠️ ${playerName} salió de la pestaña (Strike ${newStrikes}/3)`,
            lastActivity: Date.now() // ⭐ NUEVO
          });
          
          if (newStrikes >= 3) {
            await update(ref(database, `rooms/${currentRoom}`), {
              status: 'ended',
              winner: opponentName,
              message: `${playerName} fue descalificado por hacer trampa (3 strikes)`,
              lastActivity: Date.now() // ⭐ NUEVO
            });
            return;
          }
          
          let countdown = 3;
          countdownRef.current = setInterval(() => {
            countdown--;
            setAwayCountdown(countdown);
            if (countdown <= 0) {
              clearInterval(countdownRef.current);
            }
          }, 1000);
          
          awayTimeout = setTimeout(async () => {
            if (!document.hidden) return;
            
            await update(ref(database, `rooms/${currentRoom}`), {
              status: 'ended',
              winner: opponentName,
              message: `${playerName} perdió por estar fuera de la pestaña más de 3 segundos`,
              lastActivity: Date.now() // ⭐ NUEVO
            });
          }, 3000);
        }
      } else {
        setIsTabVisible(true);
        
        if (awayTimeout) {
          clearTimeout(awayTimeout);
          awayTimeout = null;
        }
        
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        
        if (tabChangeTime) {
          const timeAway = Math.floor((Date.now() - tabChangeTime) / 1000);
          
          if (database && currentRoom) {
            await update(ref(database, `rooms/${currentRoom}`), {
              message: `${playerName} regresó después de ${timeAway} segundo${timeAway !== 1 ? 's' : ''}`,
              lastActivity: Date.now() // ⭐ NUEVO
            });
          }
          
          setTabChangeTime(null);
        }
        
        setTimeout(() => {
          setShowWarning(false);
        }, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (awayTimeout) {
        clearTimeout(awayTimeout);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [screen, playerName, roomData, currentPlayer, timeLeft, tabChangeTime, player1Strikes, player2Strikes]);

  // Firebase listener
  useEffect(() => {
    if (!currentRoom || !database) return;
    
    const roomRef = ref(database, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        setUsedArtists(data.usedArtists || []);
        setMessage(data.message || '');
        setPlayer1Strikes(data.player1Strikes || 0);
        setPlayer2Strikes(data.player2Strikes || 0);
        
        if (data.status === 'ended') {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setTimeLeft(0);
          setScreen('ended');
          scheduleRoomDeletion(currentRoom, true);
          setGameEnding(false);
        } else if (data.status === 'playing') {
          setCurrentPlayer(data.currentPlayer || 1);
          
          if (data.timeLeft !== undefined && data.timeLeft !== null) {
            setTimeLeft(data.timeLeft);
          }
          
          if (screen === 'lobby') {
            setScreen('playing');
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [currentRoom, database]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      if (rematchTimerRef.current) {
        clearTimeout(rematchTimerRef.current);
      }
    };
  }, []);

  // Sistema de revancha - Countdown y auto-rechazo
  useEffect(() => {
    if (screen !== 'ended' || !roomData) return;
    
    setRematchCountdown(30);
    
    const countdownInterval = setInterval(() => {
      setRematchCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    rematchTimerRef.current = setTimeout(async () => {
      if (database && currentRoom && roomData.status === 'ended' && !roomData.rematchAccepted) {
        await remove(ref(database, `rooms/${currentRoom}`));
        setCurrentRoom(null);
        setRoomCode('');
        setScreen('menu');
        setRoomData(null);
      }
    }, 30000);
    
    return () => {
      clearInterval(countdownInterval);
      if (rematchTimerRef.current) {
        clearTimeout(rematchTimerRef.current);
      }
    };
  }, [screen, roomData?.status]);

  // Detectar cuando ambos jugadores aceptaron la revancha
  useEffect(() => {
    if (!roomData || screen !== 'ended') return;
    
    const { player1Rematch, player2Rematch, rematchDeclined } = roomData;
    
    if (rematchDeclined) {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      if (rematchTimerRef.current) {
        clearTimeout(rematchTimerRef.current);
      }
      
      setTimeout(() => {
        setCurrentRoom(null);
        setRoomCode('');
        setScreen('menu');
        setRoomData(null);
      }, 2000);
      return;
    }
    
    if (player1Rematch && player2Rematch) {
      startRematch();
    }
  }, [roomData?.player1Rematch, roomData?.player2Rematch, roomData?.rematchDeclined, screen]);

  // ========================================
  // RENDER
  // ========================================
  
  return (
    <div className="app">
      {screen === 'menu' && (
        <MenuScreen 
          playerName={playerName}
          setPlayerName={setPlayerName}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          genre={genre}
          setGenre={setGenre}
          turnTime={turnTime}
          setTurnTime={setTurnTime}
          artistType={artistType}          // ⭐ NUEVO
          setArtistType={setArtistType}    // ⭐ NUEVO
          createRoom={createRoom}
          joinRoom={joinRoom}
          checkAvailableRooms={checkAvailableRooms}
          checkingRooms={checkingRooms}
          showRoomsList={showRoomsList}
          setShowRoomsList={setShowRoomsList}
          availableRooms={availableRooms}
          joinRoomFromList={joinRoomFromList}
          goToHome={goToHome}
        />
      )}
      
      {screen === 'lobby' && (
        <LobbyScreen 
          currentRoom={currentRoom}
          roomData={roomData}
          leaveRoom={leaveRoom}
        />
      )}
      
      {screen === 'playing' && (
        <GameScreen 
          currentRoom={currentRoom}
          roomData={roomData}
          currentPlayer={currentPlayer}
          timeLeft={timeLeft}
          player1Strikes={player1Strikes}
          player2Strikes={player2Strikes}
          showWarning={showWarning}
          isTabVisible={isTabVisible}
          awayCountdown={awayCountdown}
          message={message}
          playerName={playerName}
          artistInput={artistInput}
          setArtistInput={setArtistInput}
          isVerifying={isVerifying}
          handleSubmit={handleSubmit}
        />
      )}
      
      {screen === 'ended' && (
        <EndScreen 
          roomData={roomData}
          playerName={playerName}
          usedArtists={usedArtists}
          message={message}
          leaveRoom={leaveRoom}
          requestRematch={requestRematch}
          declineRematch={declineRematch}
          rematchRequested={rematchRequested}
          rematchCountdown={rematchCountdown}
        />
      )}
    </div>
  );
};

export default MusicBattleGame;