"use client";

import React, { useState, useEffect } from 'react';
import { genres } from '../constants/genres';
import { getArtistInfo } from '../utils/musicbrainz';



const EndScreen = ({ 
  roomData, 
  playerName, 
  usedArtists, 
  message, 
  leaveRoom,
  requestRematch,
  declineRematch,
  rematchRequested,
  rematchCountdown
}) => {
  const [artistsInfo, setArtistsInfo] = useState({});
  const [hoveredArtist, setHoveredArtist] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const [finalArtists, setFinalArtists] = useState([]);
  useEffect(() => {
    if (usedArtists && usedArtists.length > 0) {
      setFinalArtists([...usedArtists]);
    }
  }, []);

  if (!roomData) return null;
  const iAmWinner = playerName === roomData.winner;

  const handleArtistHover = async (artist) => {
    setHoveredArtist(artist);
    
    if (!artistsInfo[artist]) {
      setLoadingInfo(true);
      const info = await getArtistInfo(artist);
      if (info) {
        setArtistsInfo(prev => ({ ...prev, [artist]: info }));
      }
      setLoadingInfo(false);
    }
  };
  

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
            {finalArtists.map((artist, i) => (
              <div 
                key={i} 
                className="artist-item"
                onMouseEnter={() => handleArtistHover(artist)}
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

      {/* Sistema de Revancha */}
      <div className="rematch-section">
        {!roomData.rematchDeclined ? (
          <>
            <div className="rematch-status">
              {roomData.player1Rematch && (
                <div className="rematch-indicator player1">
                  ✓ {roomData.player1} quiere revancha
                </div>
              )}
              {roomData.player2Rematch && (
                <div className="rematch-indicator player2">
                  ✓ {roomData.player2} quiere revancha
                </div>
              )}
              
              {!roomData.player1Rematch && !roomData.player2Rematch && (
                <p className="rematch-prompt">
                  ¿Quieren jugar de nuevo?
                </p>
              )}
              
              {(roomData.player1Rematch || roomData.player2Rematch) && 
               !(roomData.player1Rematch && roomData.player2Rematch) && (
                <p className="rematch-waiting">
                  Esperando al otro jugador...
                </p>
              )}
              
              <div className="rematch-countdown">
                ⏱️ La sala se cerrará en {rematchCountdown}s
              </div>
            </div>

            {!rematchRequested ? (
              <div className="rematch-buttons">
                <button onClick={requestRematch} className="btn-rematch">
                  🔄 Revancha
                </button>
                <button onClick={declineRematch} className="btn-decline">
                  ✕ Salir
                </button>
              </div>
            ) : (
              <div className="rematch-buttons">
                <button className="btn-waiting" disabled>
                  ⏳ Esperando...
                </button>
                <button onClick={declineRematch} className="btn-decline">
                  ✕ Cancelar
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rematch-declined">
            <p>❌ Revancha rechazada</p>
            <small>Volviendo al menú...</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default EndScreen;