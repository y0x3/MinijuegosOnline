"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, update, get, query, orderByChild, equalTo } from 'firebase/database';
import { getAnalytics } from "firebase/analytics";

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase
let app;
let database;
try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
} catch (error) {
  console.log("Firebase initialization:", error.message);
}

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
  
  // Estado del juego
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [artistInput, setArtistInput] = useState('');
  const [usedArtists, setUsedArtists] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [artistsInfo, setArtistsInfo] = useState({});
  const [hoveredArtist, setHoveredArtist] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [gameEnding, setGameEnding] = useState(false);
  
  // Sistema anti-trampa
  const [player1Strikes, setPlayer1Strikes] = useState(0);
  const [player2Strikes, setPlayer2Strikes] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [tabChangeTime, setTabChangeTime] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [awayCountdown, setAwayCountdown] = useState(3);
  
  // NUEVO: Sistema de verificación de salas
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showRoomsList, setShowRoomsList] = useState(false);
  const [checkingRooms, setCheckingRooms] = useState(false);
  
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const deleteTimerRef = useRef(null);

  // Géneros
  const genres = {
    rock: { name: 'Rock', tags: ['rock', 'hard rock', 'alternative rock', 'indie rock', 'punk rock', 'classic rock', 'metal', 'heavy metal'] },
    pop: { name: 'Pop', tags: ['pop', 'synth-pop', 'dance-pop', 'pop rock'] },
    rap: { name: 'Rap/Hip Hop', tags: ['rap', 'hip hop', 'hip-hop', 'gangsta rap', 'trap'] },
    electronic: { name: 'Electrónica', tags: ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep'] },
    latin: { name: 'Latina', tags: ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'merengue', 'banda'] },
    jazz: { name: 'Jazz', tags: ['jazz', 'bebop', 'smooth jazz', 'blues', 'soul'] },
    country: { name: 'Country', tags: ['country', 'bluegrass', 'folk'] },
    reggae: { name: 'Reggae', tags: ['reggae', 'dancehall', 'dub', 'ska'] }
  };

  // ========================================
  // NUEVO: Verificar salas disponibles
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
      
      // Filtrar salas que están esperando jugadores
      Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        if (room.status === 'waiting' && !room.player2) {
          available.push({
            code: room.code,
            host: room.player1,
            genre: room.genre,
            turnTime: room.turnTime,
            createdAt: room.createdAt
          });
        }
      });
      
      // Ordenar por fecha de creación (más recientes primero)
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

  // ========================================
  // NUEVO: Unirse a sala desde la lista
  // ========================================
  const joinRoomFromList = async (code) => {
    if (!playerName.trim()) {
      alert('Ingresa tu nombre primero');
      return;
    }
    
    setRoomCode(code);
    setShowRoomsList(false);
    
    // Usar la función joinRoom existente
    setTimeout(() => joinRoom(code), 100);
  };

  // ========================================
  // NUEVO: Auto-eliminar sala al terminar
  // ========================================
  const scheduleRoomDeletion = (roomCode) => {
    // Eliminar la sala después de 10 segundos
    deleteTimerRef.current = setTimeout(async () => {
      if (database && roomCode) {
        try {
          await remove(ref(database, `rooms/${roomCode}`));
          console.log(`Sala ${roomCode} eliminada automáticamente`);
        } catch (error) {
          console.error('Error al eliminar sala:', error);
        }
      }
    }, 10000); // 10 segundos
  };

  // Limpiar timer de eliminación cuando se desmonta el componente
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  // Normalizar texto
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Similitud
  const calculateSimilarity = (str1, str2) => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const costs = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[longer.length] = lastValue;
    }
    
    return 1 - (costs[longer.length] / longer.length);
  };

  // Buscar artista
  const searchArtist = async (query) => {
    if (query.length < 2) return [];
    
    try {
      const response = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=10`,
        { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
      );

      if (!response.ok) return [];
      const data = await response.json();
      if (!data.artists) return [];
      
      const results = data.artists.map(artist => ({
        ...artist,
        similarity: calculateSimilarity(query, artist.name)
      }));
      
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, 5);
    } catch (error) {
      return [];
    }
  };

  // Obtener información detallada del artista
  const getArtistInfo = async (artistName) => {
    if (artistsInfo[artistName]) {
      return artistsInfo[artistName];
    }

    setLoadingInfo(true);
    try {
      const results = await searchArtist(artistName);
      if (results.length === 0) return null;

      const artist = results[0];
      const detailsResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=tags+genres+annotation&fmt=json`,
        { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
      );

      if (!detailsResponse.ok) return null;

      const details = await detailsResponse.json();
      
      // Intentar obtener imagen del Cover Art Archive
      let imageUrl = null;
      try {
        const releasesResponse = await fetch(
          `https://musicbrainz.org/ws/2/release?artist=${artist.id}&fmt=json&limit=1`,
          { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
        );
        
        if (releasesResponse.ok) {
          const releasesData = await releasesResponse.json();
          if (releasesData.releases && releasesData.releases.length > 0) {
            const releaseId = releasesData.releases[0].id;
            const coverResponse = await fetch(
              `https://coverartarchive.org/release/${releaseId}`,
              { method: 'GET' }
            );
            
            if (coverResponse.ok) {
              const coverData = await coverResponse.json();
              if (coverData.images && coverData.images.length > 0) {
                imageUrl = coverData.images[0].thumbnails?.small || coverData.images[0].image;
              }
            }
          }
        }
      } catch (error) {
        console.log('No se pudo obtener imagen:', error);
      }

      const info = {
        name: details.name,
        country: details.country || 'Desconocido',
        type: details.type === 'Group' ? 'Banda' : 'Solista',
        beginYear: details['life-span']?.begin?.split('-')[0] || '?',
        endYear: details['life-span']?.end?.split('-')[0] || 'Activo',
        genres: [...(details.tags || []).map(t => t.name), ...(details.genres || []).map(g => g.name)]
          .slice(0, 5)
          .join(', ') || 'No especificado',
        image: imageUrl
      };

      setArtistsInfo(prev => ({ ...prev, [artistName]: info }));
      return info;
    } catch (error) {
      return null;
    } finally {
      setLoadingInfo(false);
    }
  };

  // Verificar artista
  const verifyArtist = async (artistName) => {
    try {
      setIsVerifying(true);
      setMessage('Verificando...');

      const results = await searchArtist(artistName);
      
      if (results.length === 0) {
        return { valid: false, reason: 'Artista no encontrado' };
      }

      const bestMatch = results[0];
      
      if (bestMatch.similarity < 0.7) {
        return { 
          valid: false, 
          reason: `No encontrado. ¿Quisiste decir "${bestMatch.name}"?` 
        };
      }

      const normalizedName = normalizeText(bestMatch.name);
      const alreadyUsed = usedArtists.some(used => 
        normalizeText(used) === normalizedName
      );
      
      if (alreadyUsed) {
        return { valid: false, reason: `${bestMatch.name} ya fue usado` };
      }

      const tagsResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/${bestMatch.id}?inc=tags+genres&fmt=json`,
        { headers: { 'User-Agent': 'MusicBattleGame/2.0' } }
      );

      if (!tagsResponse.ok) {
        return { valid: true, artistName: bestMatch.name, warning: 'Género no verificado' };
      }

      const tagsData = await tagsResponse.json();
      const artistTags = [
        ...(tagsData.tags || []).map(t => t.name.toLowerCase()),
        ...(tagsData.genres || []).map(g => g.name.toLowerCase())
      ];

      const genreTags = genres[genre].tags;
      const hasGenre = artistTags.some(tag => 
        genreTags.some(genreTag => 
          tag.includes(genreTag) || genreTag.includes(tag)
        )
      );

      if (!hasGenre && artistTags.length > 0) {
        return { 
          valid: false, 
          reason: `${bestMatch.name} no es ${genres[genre].name}` 
        };
      }

      return { valid: true, artistName: bestMatch.name };

    } catch (error) {
      return { valid: false, reason: 'Error de conexión' };
    } finally {
      setIsVerifying(false);
    }
  };

  // Timer
  // Timer
useEffect(() => {
  // No ejecutar si el juego ya terminó
  if (screen !== 'playing' || !roomData || roomData.status === 'ended') {
    return;
  }
  
  if (timeLeft > 0 && isTabVisible) {
    timerRef.current = setTimeout(() => {
      const newTime = timeLeft - 1;
      setTimeLeft(newTime);
      
      if (currentRoom && database && newTime > 0) {
        // Solo actualizar Firebase si NO es 0
        update(ref(database, `rooms/${currentRoom}`), { timeLeft: newTime });
      } else if (newTime === 0) {
        // Cuando llega a 0, llamar handleTimeUp
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

  // Detector de cambio de pestaña - Sistema Anti-Trampa
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
          
          await update(ref(database, `rooms/${currentRoom}`), updateData);
          
          const opponentName = isPlayer1 ? roomData.player2 : roomData.player1;
          await update(ref(database, `rooms/${currentRoom}`), {
            message: `⚠️ ${playerName} salió de la pestaña (Strike ${newStrikes}/3)`
          });
          
          if (newStrikes >= 3) {
            await update(ref(database, `rooms/${currentRoom}`), {
              status: 'ended',
              winner: opponentName,
              message: `${playerName} fue descalificado por hacer trampa (3 strikes)`
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
              message: `${playerName} perdió por estar fuera de la pestaña más de 3 segundos`
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
              message: `${playerName} regresó después de ${timeAway} segundo${timeAway !== 1 ? 's' : ''}`
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

  // Listener Firebase
  // Listener Firebase - VERSIÓN CORREGIDA
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
        // Juego terminado - detener TODO
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setTimeLeft(0);
        setScreen('ended');
        scheduleRoomDeletion(currentRoom);
        setGameEnding(false);
      } else if (data.status === 'playing') {
        // ⭐ CLAVE: Solo actualizar timeLeft si viene un valor MAYOR que el actual
        // o si es un cambio de turno (currentPlayer diferente)
        const isNewTurn = data.currentPlayer !== currentPlayer;
        
        if (isNewTurn || data.timeLeft > timeLeft) {
          setTimeLeft(data.timeLeft || turnTime);
          setCurrentPlayer(data.currentPlayer || 1);
        }
        
        if (screen === 'lobby') {
          setScreen('playing');
        }
      }
    }
  });
  
  return () => unsubscribe();
}, [currentRoom, database]); // ⚠️ NO incluir timeLeft ni currentPlayer aquí

  // Crear sala
  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Ingresa tu nombre');
      return;
    }
    
    if (!database) {
      alert('Error: Firebase no configurado');
      return;
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
      currentPlayer: 1,
      timeLeft: turnTime,
      usedArtists: [],
      status: 'waiting',
      message: 'Esperando jugador 2...',
      createdAt: Date.now(),
      player1Strikes: 0,
      player2Strikes: 0
    });
    
    setCurrentRoom(code);
    setRoomCode(code);
    setScreen('lobby');
  };

  // Unirse - MODIFICADO para aceptar código como parámetro
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
      message: `¡${room.player1} comienza!`
    });
    
    setCurrentRoom(code.toUpperCase());
    setGenre(room.genre);
    setTurnTime(room.turnTime);
    setScreen('playing');
  };

  // Tiempo agotado
  const handleTimeUp = async () => {
    console.log('⏰ handleTimeUp llamado', { gameEnding, status: roomData?.status }); // Debug
    
    if (!currentRoom || !roomData || !database) return;
    if (roomData.status === 'ended' || gameEnding) return;
    
    setGameEnding(true);
    
    const loser = currentPlayer === 1 ? roomData.player1 : roomData.player2;
    const winner = currentPlayer === 1 ? roomData.player2 : roomData.player1;
    
    // Detener el timer localmente
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setTimeLeft(0);
    
    console.log('🏁 Actualizando Firebase - Juego terminado'); // Debug
    
    try {
      await update(ref(database, `rooms/${currentRoom}`), {
        status: 'ended',
        winner,
        timeLeft: 0,
        message: `⏱️ Tiempo agotado. ${loser} pierde`
      });
    } catch (error) {
      console.error('Error al actualizar Firebase:', error);
      setGameEnding(false);
    }
  };

  // Enviar
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
        message: `✓ ${result.artistName}! Turno: ${nextPlayerName}`
      });
      
      setArtistInput('');
      
    } else if (database) {
      const loserName = currentPlayer === 1 ? roomData.player1 : roomData.player2;
      const winnerName = currentPlayer === 1 ? roomData.player2 : roomData.player1;
      
      await update(ref(database, `rooms/${currentRoom}`), {
        status: 'ended',
        winner: winnerName,
        message: `${result.reason}. ${loserName} pierde`
      });
    }
  };

  // Salir
  const leaveRoom = async () => {
    if (currentRoom && database) {
      // Cancelar timer de eliminación si existe
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

  // Volver al inicio
  const goToHome = () => {
    router.push('/');
  };

  // RENDERS
  const renderMenu = () => (
    <div className="menu-screen">
      <button onClick={goToHome} className="btn-back">
        ← Inicio
      </button>

      <div className="logo">
        <div className="logo-icon">🎵</div>
        <h1>Music Battle</h1>
        <p>Demuestra tu conocimiento musical</p>
      </div>

      <input
        type="text"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Tu nombre"
        maxLength={20}
        className="name-input"
      />

      <div className="actions">
        <button onClick={createRoom} className="btn-primary">
          ➕ Crear Sala
        </button>

        {/* NUEVO: Botón para ver salas disponibles */}
        <button 
          onClick={checkAvailableRooms} 
          className="btn-secondary"
          disabled={checkingRooms}
        >
          {checkingRooms ? '🔍 Buscando...' : '🔍 Buscar Salas'}
        </button>

        <div className="join-section">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Código de sala"
            maxLength={6}
            className="code-input"
          />
          <button onClick={() => joinRoom()} className="btn-secondary">
            Unirse a Sala
          </button>
        </div>
      </div>

      <div className="settings">
        <h3>Configuración</h3>
        
        <div className="settings-grid">
          <div className="setting">
            <label>Género</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {Object.entries(genres).map(([key, val]) => (
                <option key={key} value={key}>{val.name}</option>
              ))}
            </select>
          </div>

          <div className="setting">
            <label>Tiempo</label>
            <select value={turnTime} onChange={(e) => setTurnTime(Number(e.target.value))}>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="45">45s</option>
              <option value="60">60s</option>
              <option value="90">90s</option>
            </select>
          </div>
        </div>
      </div>

      {/* NUEVO: Modal de salas disponibles */}
      {showRoomsList && (
        <div className="modal-overlay" onClick={() => setShowRoomsList(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎮 Salas Disponibles</h3>
              <button onClick={() => setShowRoomsList(false)} className="btn-close">✕</button>
            </div>
            
            <div className="rooms-list">
              {availableRooms.length === 0 ? (
                <div className="no-rooms">
                  <p>😔 No hay salas disponibles</p>
                  <small>Crea una nueva sala para empezar</small>
                </div>
              ) : (
                availableRooms.map(room => (
                  <div key={room.code} className="room-card">
                    <div className="room-info">
                      <div className="room-code">
                        <strong>{room.code}</strong>
                      </div>
                      <div className="room-details">
                        <span>👤 {room.host}</span>
                        <span>🎵 {genres[room.genre]?.name}</span>
                        <span>⏱️ {room.turnTime}s</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => joinRoomFromList(room.code)}
                      className="btn-join-room"
                    >
                      Unirse
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={checkAvailableRooms} className="btn-refresh">
              🔄 Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLobby = () => (
    <div className="lobby-screen">
      <h2>Sala: {currentRoom}</h2>
      
      <div className="code-box">
        <span>Código:</span>
        <strong>{currentRoom}</strong>
      </div>

      <div className="players">
        <div className="player-slot">
          <span>👤</span>
          <p>{roomData?.player1}</p>
          <small>Host</small>
        </div>
        
        <div className="vs">VS</div>
        
        <div className="player-slot">
          {roomData?.player2 ? (
            <>
              <span>👤</span>
              <p>{roomData.player2}</p>
            </>
          ) : (
            <p className="waiting">Esperando...</p>
          )}
        </div>
      </div>

      <div className="lobby-info">
        <div><strong>Género:</strong> {genres[roomData?.genre]?.name}</div>
        <div><strong>Tiempo:</strong> {roomData?.turnTime}s</div>
      </div>

      <button onClick={leaveRoom} className="btn-danger">
        Salir
      </button>
    </div>
  );

  const renderGame = () => {
    if (!roomData) return null;
    
    const isMyTurn = (currentPlayer === 1 && playerName === roomData.player1) ||
                     (currentPlayer === 2 && playerName === roomData.player2);
    
    return (
      <div className="game-screen">
        <div className="header">
          <small>Sala: {currentRoom}</small>
          
          <div className="players-bar">
            <div className={`player ${currentPlayer === 1 ? 'active' : ''}`}>
              <span className="player-name">{roomData.player1}</span>
              <div className="strikes">
                {[...Array(3)].map((_, i) => (
                  <span key={i} className={`strike ${i < player1Strikes ? 'active' : ''}`}>⚠️</span>
                ))}
              </div>
            </div>
            
            <div className={`timer ${timeLeft <= 10 ? 'warning' : ''}`}>
              {timeLeft}
            </div>
            
            <div className={`player ${currentPlayer === 2 ? 'active' : ''}`}>
              <span className="player-name">{roomData.player2}</span>
              <div className="strikes">
                {[...Array(3)].map((_, i) => (
                  <span key={i} className={`strike ${i < player2Strikes ? 'active' : ''}`}>⚠️</span>
                ))}
              </div>
            </div>
          </div>

          <div className="genre">
            <strong>{genres[roomData.genre]?.name}</strong>
          </div>
        </div>

        {showWarning && !isTabVisible && (
          <div className="tab-warning critical">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>¡REGRESA AHORA!</strong>
              <p>Pierdes en: <span className="countdown">{awayCountdown}</span>s</p>
            </div>
          </div>
        )}

        <div className="message">{message}</div>

        {isMyTurn && (
          <div className="input-box">
            <input
              type="text"
              value={artistInput}
              onChange={(e) => setArtistInput(e.target.value)}
              placeholder="Nombre del artista..."
              disabled={isVerifying}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isVerifying) handleSubmit();
              }}
              className="artist-input"
            />
            
            <button 
              onClick={() => handleSubmit()} 
              disabled={isVerifying || !artistInput.trim()}
            >
              {isVerifying ? '...' : 'Enviar'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderEnded = () => {
    if (!roomData) return null;
    const iAmWinner = playerName === roomData.winner;
    
    return (
      <div className="end-screen">
        <div className={`banner ${iAmWinner ? 'win' : 'lose'}`}>
          <div className="icon">{iAmWinner ? '🏆' : '😔'}</div>
          <h2>{iAmWinner ? '¡Victoria!' : 'Derrota'}</h2>
          <p>{roomData.winner} gana</p>
        </div>

        <div className="summary">
          <div className="summary-header">
            <h3>Resumen</h3>
            <p className="summary-message">{message}</p>
            {/* NUEVO: Indicador de auto-eliminación */}
            <p className="auto-delete-notice">
              🗑️ Esta sala se eliminará automáticamente en 10 segundos
            </p>
          </div>
          
          <div className="stats">
            <div>
              <small>Artistas</small>
              <strong>{usedArtists.length}</strong>
            </div>
            <div>
              <small>Género</small>
              <strong>{genres[roomData.genre]?.name}</strong>
            </div>
          </div>

          <div className="final-list">
            <h4>Lista completa:</h4>
            <div className="artist-scroll">
              {usedArtists.map((artist, i) => (
                <div 
                  key={i} 
                  className="artist-item"
                  onMouseEnter={() => {
                    setHoveredArtist(artist);
                    getArtistInfo(artist);
                  }}
                  onMouseLeave={() => setHoveredArtist(null)}
                >
                  <span className="artist-number">{i + 1}.</span>
                  <span className="artist-name">{artist}</span>
                  
                  {hoveredArtist === artist && (
                    <div className="artist-tooltip">
                      {loadingInfo && !artistsInfo[artist] ? (
                        <div className="loading">Cargando...</div>
                      ) : artistsInfo[artist] ? (
                        <>
                          {artistsInfo[artist].image && (
                            <div className="tooltip-image">
                              <img src={artistsInfo[artist].image} alt={artistsInfo[artist].name} />
                            </div>
                          )}
                          <div className="tooltip-header">{artistsInfo[artist].name}</div>
                          <div className="tooltip-row">
                            <span className="label">Tipo:</span>
                            <span>{artistsInfo[artist].type}</span>
                          </div>
                          <div className="tooltip-row">
                            <span className="label">País:</span>
                            <span>{artistsInfo[artist].country}</span>
                          </div>
                          <div className="tooltip-row">
                            <span className="label">Años:</span>
                            <span>{artistsInfo[artist].beginYear} - {artistsInfo[artist].endYear}</span>
                          </div>
                          <div className="tooltip-row">
                            <span className="label">Géneros:</span>
                            <span className="genres">{artistsInfo[artist].genres}</span>
                          </div>
                        </>
                      ) : (
                        <div className="error">Info no disponible</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={leaveRoom} className="btn-primary">
          Volver al menú
        </button>
      </div>
    );
  };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Inter:wght@400;600;700&display=swap');

        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }

        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden;
          position: fixed;
        }

        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
          background-attachment: fixed;
        }

        .app {
          height: 100vh;
          height: 100dvh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1vh 1vw;
          overflow: hidden;
        }

        /* MENU SCREEN */
        .menu-screen {
          width: 100%;
          max-width: min(500px, 90vw);
          height: 100%;
          max-height: 98vh;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(30px, 3vh);
          padding: 3vh 3vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .btn-back {
          position: absolute;
          top: 2vh;
          left: 2vw;
          padding: 0.8vh 1.5vw;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          color: #fff;
          font-size: min(14px, 2vh);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          z-index: 10;
        }

        .btn-back:hover {
          background: rgba(255,255,255,0.15);
          transform: translateX(-3px);
        }

        .logo { 
          text-align: center; 
          margin-top: 4vh;
          margin-bottom: 2vh;
          flex-shrink: 0;
        }

        .logo-icon { 
          font-size: min(60px, 8vh); 
          margin-bottom: 1vh; 
        }

        .logo h1 {
          font-family: 'Righteous', cursive;
          font-size: min(2.5em, 6vh);
          color: #fff;
          margin-bottom: 0.5vh;
          line-height: 1;
        }

        .logo p { 
          color: rgba(255,255,255,0.7); 
          font-size: min(1rem, 2vh);
        }

        .name-input, .code-input {
          width: 100%;
          padding: 1.5vh 1vw;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 15px;
          color: #fff;
          font-size: min(16px, 2vh);
          margin-bottom: 2vh;
          text-align: center;
          flex-shrink: 0;
        }

        .name-input::placeholder, .code-input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .name-input:focus, .code-input:focus {
          outline: none;
          border-color: #00d4ff;
          box-shadow: 0 0 20px rgba(0,212,255,0.3);
        }

        .actions { 
          margin-bottom: 2vh;
          flex-shrink: 0;
        }

        .btn-primary, .btn-secondary, .btn-danger {
          width: 100%;
          padding: 1.8vh 0;
          border: none;
          border-radius: 15px;
          font-size: min(16px, 2vh);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #00d4ff, #7b2ff7);
          color: #fff;
          margin-bottom: 1.5vh;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,212,255,0.4);
        }

        .join-section {
          display: flex;
          flex-direction: column;
          gap: 1vh;
        }

        .join-section .code-input {
          margin: 0;
          text-transform: uppercase;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 2px solid rgba(255,255,255,0.2);
          margin-bottom: 1vh;
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.15);
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-danger {
          background: rgba(255,0,0,0.2);
          color: #fff;
          border: 2px solid rgba(255,0,0,0.4);
        }

        .btn-danger:hover {
          background: rgba(255,0,0,0.3);
        }

        .settings {
          background: rgba(0,0,0,0.2);
          padding: 2vh 2vw;
          border-radius: 20px;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .settings h3 {
          color: #fff;
          margin-bottom: 1.5vh;
          font-size: min(1.2rem, 2.5vh);
          flex-shrink: 0;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5vw;
          flex: 1;
          align-content: start;
        }

        .setting {
          display: flex;
          flex-direction: column;
        }

        .setting label {
          display: block;
          color: rgba(255,255,255,0.8);
          margin-bottom: 0.5vh;
          font-size: min(14px, 1.8vh);
        }

        .setting select {
          width: 100%;
          padding: 1.2vh 0.5vw;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          color: #fff;
          cursor: pointer;
          font-size: min(15px, 1.8vh);
        }

        .setting select:focus {
          outline: none;
          border-color: #00d4ff;
        }

        .setting select option {
          background: #1a1a2e;
        }

        /* NUEVO: Modal de salas */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 25px;
          padding: 3vh 3vw;
          max-width: min(500px, 90vw);
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: slideUp 0.3s;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2vh;
          flex-shrink: 0;
        }

        .modal-header h3 {
          color: #fff;
          font-size: min(1.5rem, 3vh);
          margin: 0;
        }

        .btn-close {
          background: rgba(255,0,0,0.2);
          border: 2px solid rgba(255,0,0,0.4);
          color: #fff;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-close:hover {
          background: rgba(255,0,0,0.4);
          transform: rotate(90deg);
        }

        .rooms-list {
          flex: 1;
          overflow-y: auto;
          padding-right: 1vw;
          margin-bottom: 2vh;
        }

        .rooms-list::-webkit-scrollbar {
          width: 6px;
        }

        .rooms-list::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }

        .rooms-list::-webkit-scrollbar-thumb {
          background: rgba(0,212,255,0.5);
          border-radius: 10px;
        }

        .no-rooms {
          text-align: center;
          padding: 5vh 2vw;
          color: rgba(255,255,255,0.6);
        }

        .no-rooms p {
          font-size: min(1.2rem, 2.5vh);
          margin-bottom: 1vh;
        }

        .no-rooms small {
          font-size: min(0.9rem, 1.8vh);
        }

        .room-card {
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 2vh 2vw;
          margin-bottom: 1.5vh;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s;
        }

        .room-card:hover {
          background: rgba(0,212,255,0.1);
          border-color: rgba(0,212,255,0.3);
          transform: translateX(5px);
        }

        .room-info {
          flex: 1;
        }

        .room-code {
          margin-bottom: 1vh;
        }

        .room-code strong {
          color: #00d4ff;
          font-size: min(1.3rem, 2.8vh);
          letter-spacing: 2px;
        }

        .room-details {
          display: flex;
          gap: 1.5vw;
          flex-wrap: wrap;
        }

        .room-details span {
          color: rgba(255,255,255,0.7);
          font-size: min(0.85rem, 1.8vh);
        }

        .btn-join-room {
          background: linear-gradient(135deg, #00d4ff, #7b2ff7);
          border: 1vw;
          color: #fff;
          padding: 1vh 2vw;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          font-size: min(14px, 1.8vh);
        }

        .btn-join-room:hover {
          transform: scale(1.05);
          box-shadow: 0 5px 20px rgba(0,212,255,0.4);
        }

        .btn-refresh {
          width: 100%;
          padding: 1.5vh 0;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 15px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          font-size: min(15px, 2vh);
          flex-shrink: 0;
        }

        .btn-refresh:hover {
          background: rgba(255,255,255,0.15);
        }

        /* LOBBY SCREEN */
        .lobby-screen {
          width: 100%;
          max-width: min(500px, 90vw);
          height: 100%;
          max-height: 98vh;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(30px, 3vh);
          padding: 3vh 3vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .lobby-screen h2 {
          color: #fff;
          text-align: center;
          font-size: min(1.6rem, 4vh);
          margin-bottom: 2vh;
          flex-shrink: 0;
        }

        .code-box {
          text-align: center;
          background: rgba(0,212,255,0.2);
          border: 2px dashed #00d4ff;
          border-radius: 15px;
          padding: 2vh 0;
          color: rgba(255,255,255,0.7);
          flex-shrink: 0;
        }

        .code-box strong {
          display: block;
          color: #00d4ff;
          font-size: min(1.8em, 5vh);
          letter-spacing: 3px;
          margin-top: 0.5vh;
        }

        .players {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2vw;
          flex: 1;
          max-height: 30vh;
        }

        .player-slot {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 3vh 1vw;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .player-slot span {
          font-size: min(30px, 6vh);
          margin-bottom: 1vh;
        }

        .player-slot p {
          color: #fff;
          font-weight: 600;
          font-size: min(1rem, 2.2vh);
        }

        .player-slot small {
          display: block;
          color: #00d4ff;
          margin-top: 0.5vh;
          font-size: min(11px, 1.5vh);
        }

        .waiting {
          color: rgba(255,255,255,0.4);
          font-style: italic;
        }

        .vs {
          font-size: min(1.5em, 4vh);
          color: #00d4ff;
          font-weight: bold;
          flex-shrink: 0;
        }

        .lobby-info {
          background: rgba(0,0,0,0.2);
          padding: 2vh 0;
          border-radius: 15px;
          color: rgba(255,255,255,0.8);
          text-align: center;
          font-size: min(1rem, 2vh);
          flex-shrink: 0;
        }

        .lobby-info div {
          margin: 0.5vh 0;
        }

        .lobby-info strong {
          color: #00d4ff;
        }

        /* GAME SCREEN */
        .game-screen {
          width: 100%;
          max-width: min(800px, 95vw);
          height: 100%;
          max-height: 98vh;
          display: flex;
          flex-direction: column;
          gap: 1.5vh;
          justify-content: space-between;
        }

        .header {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(25px, 3vh);
          padding: 2vh 2vw;
          flex-shrink: 0;
        }

        .header small {
          display: block;
          text-align: center;
          color: rgba(255,255,255,0.6);
          margin-bottom: 1.5vh;
          font-size: min(13px, 1.6vh);
        }

        .players-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5vh;
          gap: 1.5vw;
        }

        .player {
          flex: 1;
          padding: 1.5vh 1vw;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(20px, 2.5vh);
          color: #fff;
          text-align: center;
          transition: all 0.3s;
        }

        .player.active {
          background: rgba(0,212,255,0.2);
          border-color: #00d4ff;
          transform: scale(1.05);
        }

        .player-name {
          display: block;
          margin-bottom: 0.5vh;
          font-weight: 600;
          font-size: min(1rem, 2vh);
        }

        .strikes {
          display: flex;
          justify-content: center;
          gap: 0.5vw;
          font-size: min(12px, 1.6vh);
        }

        .strike {
          opacity: 0.2;
          filter: grayscale(100%);
          transition: all 0.3s;
        }

        .strike.active {
          opacity: 1;
          filter: grayscale(0%);
          animation: strikeAlert 0.5s ease;
        }

        @keyframes strikeAlert {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }

        .tab-warning.critical {
          background: rgba(255, 0, 0, 0.95);
          border: 3px solid #ff0000;
          border-radius: 15px;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2vw;
          padding: 2vh 2vw;
          flex-shrink: 0;
        }

        .warning-icon {
          font-size: min(3em, 6vh);
          animation: shake 0.5s infinite;
        }

        @keyframes shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        .warning-text {
          text-align: left;
        }

        .warning-text strong {
          display: block;
          font-size: min(1.5em, 3vh);
          margin-bottom: 0.5vh;
        }

        .warning-text p {
          margin: 0;
          font-size: min(1.2em, 2.5vh);
        }

        .countdown {
          display: inline-block;
          background: #fff;
          color: #ff0000;
          padding: 0.5vh 1vw;
          border-radius: 10px;
          font-size: min(1.5em, 3vh);
          font-weight: bold;
          margin: 0 0.5vw;
          min-width: min(40px, 5vw);
          text-align: center;
        }

        .timer {
          width: min(70px, 10vh);
          height: min(70px, 10vh);
          background: rgba(0,212,255,0.2);
          border: 3px solid #00d4ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: min(1.8em, 4vh);
          font-weight: bold;
          color: #00d4ff;
          flex-shrink: 0;
        }

        .timer.warning {
          background: rgba(255,0,0,0.2);
          border-color: #ff0000;
          color: #ff0000;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .genre {
          text-align: center;
          color: rgba(255,255,255,0.8);
          font-size: min(1rem, 2vh);
        }

        .genre strong {
          color: #00d4ff;
        }

        .message {
          background: rgba(0,0,0,0.3);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 2vh 1vw;
          text-align: center;
          color: #fff;
          min-height: 6vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: min(1rem, 2vh);
          flex-shrink: 0;
        }

        .input-box {
          display: flex;
          gap: 1vw;
          flex-shrink: 0;
        }

        .artist-input {
          flex: 1;
          padding: 2vh 1vw;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 15px;
          color: #fff;
          font-size: min(16px, 2vh);
        }

        .artist-input:focus {
          outline: none;
          border-color: #00d4ff;
        }

        .artist-input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .input-box button {
          padding: 2vh 3vw;
          background: linear-gradient(135deg, #00d4ff, #7b2ff7);
          border: none;
          border-radius: 15px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-size: min(16px, 2vh);
        }

        .input-box button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* END SCREEN */
        .end-screen {
          width: 100%;
          max-width: min(500px, 90vw);
          height: 100%;
          max-height: 98vh;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(30px, 3vh);
          padding: 2vh 3vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 2vh;
        }

        .banner {
          background: rgba(255,255,255,0.05);
          border: 3px solid;
          border-radius: min(30px, 3vh);
          padding: 3vh 2vw;
          text-align: center;
          flex-shrink: 0;
        }

        .banner.win {
          border-color: #00ff88;
        }

        .banner.lose {
          border-color: #ff4444;
        }

        .banner .icon {
          font-size: min(80px, 10vh);
          margin-bottom: 1vh;
        }

        .banner h2 {
          font-family: 'Righteous', cursive;
          font-size: min(2.5em, 5vh);
          color: #fff;
          margin-bottom: 1vh;
          line-height: 1;
        }

        .banner p {
          color: rgba(255,255,255,0.8);
          font-size: min(1.1em, 2.5vh);
        }

        .summary {
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: min(25px, 3vh);
          padding: 2vh 2vw;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 1.5vh;
        }

        .summary-header {
          flex-shrink: 0;
        }

        .summary h3 {
          color: #fff;
          margin-bottom: 1vh;
          font-size: min(1.3rem, 2.8vh);
        }

        .summary-message {
          color: rgba(255,255,255,0.8);
          font-size: min(1rem, 2vh);
        }

        .auto-delete-notice {
          color: rgba(255,200,0,0.8);
          font-size: min(0.85rem, 1.8vh);
          margin-top: 0.5vh;
          font-style: italic;
        }

        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5vw;
          flex-shrink: 0;
        }

        .stats > div {
          background: rgba(0,0,0,0.3);
          padding: 2vh 1vw;
          border-radius: 15px;
          text-align: center;
        }

        .stats small {
          display: block;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.5vh;
          font-size: min(0.85rem, 1.8vh);
        }

        .stats strong {
          display: block;
          color: #00d4ff;
          font-size: min(1.5em, 3.5vh);
        }

        .final-list {
          background: rgba(0,0,0,0.2);
          padding: 1.5vh 1.5vw;
          border-radius: 15px;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .final-list h4 {
          color: #fff;
          margin-bottom: 1vh;
          font-size: min(1.1rem, 2.2vh);
          flex-shrink: 0;
        }

        .artist-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 0.5vw;
          min-height: 0;
        }

        .artist-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .artist-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }

        .artist-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,212,255,0.5);
          border-radius: 10px;
        }

        .artist-item {
          position: relative;
          color: rgba(255,255,255,0.8);
          padding: 1.2vh 1vw;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 1vw;
          font-size: min(0.95rem, 2vh);
        }

        .artist-item:hover {
          background: rgba(0,212,255,0.1);
          border-radius: 8px;
        }

        .artist-item:last-child {
          border-bottom: none;
        }

        .artist-number {
          color: #00d4ff;
          font-weight: bold;
          min-width: min(25px, 3vw);
        }

        .artist-name {
          flex: 1;
        }

        .artist-tooltip {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.95);
          border: 2px solid #00d4ff;
          border-radius: 12px;
          padding: 2vh 2vw;
          min-width: min(280px, 80vw);
          max-width: min(350px, 90vw);
          z-index: 1000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.8);
          animation: fadeIn 0.2s;
        }

        .tooltip-image {
          width: 100%;
          margin-bottom: 1.5vh;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
        }

        .tooltip-image img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 8px;
        }

        .tooltip-header {
          color: #00d4ff;
          font-size: min(1.1em, 2.2vh);
          font-weight: bold;
          margin-bottom: 1.5vh;
          padding-bottom: 1vh;
          border-bottom: 1px solid rgba(0,212,255,0.3);
        }

        .tooltip-row {
          display: flex;
          gap: 1vw;
          margin-bottom: 1vh;
          font-size: min(0.9em, 1.8vh);
        }

        .tooltip-row .label {
          color: rgba(255,255,255,0.6);
          min-width: 60px;
          font-weight: 600;
        }

        .tooltip-row span:not(.label) {
          color: #fff;
        }

        .tooltip-row .genres {
          color: #00d4ff;
        }

        .loading, .error {
          color: rgba(255,255,255,0.6);
          text-align: center;
          padding: 1vh;
          font-style: italic;
        }

        .error {
          color: #ff4444;
        }

        /* MOBILE ADJUSTMENTS */
        @media (max-width: 768px) {
          .app {
            padding: 0.5vh 0.5vw;
          }

          .menu-screen, .lobby-screen, .end-screen {
            padding: 2vh 4vw;
            border-radius: 20px;
          }

          .game-screen {
            gap: 1vh;
          }

          .players-bar {
            flex-direction: row;
          }

          .settings-grid {
            grid-template-columns: 1fr;
            gap: 1.5vh;
          }

          .stats {
            gap: 2vw;
          }

          .input-box {
            gap: 2vw;
          }

          .input-box button {
            padding: 2vh 4vw;
          }
        }

        /* LANDSCAPE MOBILE */
        @media (max-height: 500px) and (orientation: landscape) {
          .logo {
            margin-top: 1vh;
            margin-bottom: 1vh;
          }

          .logo-icon {
            font-size: min(40px, 6vh);
          }

          .logo h1 {
            font-size: min(2em, 4vh);
          }

          .settings {
            padding: 1vh 2vw;
          }

          .banner {
            padding: 2vh 2vw;
          }

          .banner .icon {
            font-size: min(50px, 7vh);
          }
        }
      `}</style>

      {screen === 'menu' && renderMenu()}
      {screen === 'lobby' && renderLobby()}
      {screen === 'playing' && renderGame()}
      {screen === 'ended' && renderEnded()}
    </div>
  );
};

export default MusicBattleGame;