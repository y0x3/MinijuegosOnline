"use client";

import React from 'react';
import { genres } from '../constants/genres';

const LobbyScreen = ({ currentRoom, roomData, leaveRoom }) => {
  return (
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
};

export default LobbyScreen;