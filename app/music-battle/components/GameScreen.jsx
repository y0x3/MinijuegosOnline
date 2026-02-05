"use client";

import React from 'react';
import { genres } from '../constants/genres';

const GameScreen = ({
  currentRoom,
  roomData,
  currentPlayer,
  timeLeft,
  player1Strikes,
  player2Strikes,
  showWarning,
  isTabVisible,
  awayCountdown,
  message,
  playerName,
  artistInput,
  setArtistInput,
  isVerifying,
  handleSubmit
}) => {
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
            onClick={handleSubmit} 
            disabled={isVerifying || !artistInput.trim()}
          >
            {isVerifying ? '...' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GameScreen;