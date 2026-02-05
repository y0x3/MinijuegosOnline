"use client";

import React from 'react';
import { genres } from '../constants/genres';

const MenuScreen = ({
  playerName,
  setPlayerName,
  roomCode,
  setRoomCode,
  genre,
  setGenre,
  turnTime,
  setTurnTime,
  artistType,
  setArtistType,
  createRoom,
  joinRoom,
  checkAvailableRooms,
  checkingRooms,
  showRoomsList,
  setShowRoomsList,
  availableRooms,
  joinRoomFromList,
  goToHome
}) => {
  return (
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
            <label>Tipo de artista</label>
            <select value={artistType} onChange={(e) => setArtistType(e.target.value)}>
              <option value="both">Ambos (Solistas y Bandas)</option>
              <option value="bands">Solo Bandas/Grupos</option>
              <option value="solo">Solo Artistas Solistas</option>
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

      {/* Modal de salas disponibles */}
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
                        <span>
                          {room.artistType === 'both' ? '🎤🎸 Ambos' : 
                           room.artistType === 'bands' ? '🎸 Bandas' : 
                           '🎤 Solistas'}
                        </span>
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
};

export default MenuScreen;