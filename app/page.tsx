"use client";

import { useRouter } from "next/navigation";

const games = [
  {
    id: "music-battle",
    title: "Music Battle",
    description: "Demuestra tu conocimiento musical en duelos 1v1 en tiempo real",
    icon: "🎵",
    color: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
    path: "/music-battle",
    status: "Disponible"
  },
  {
    id: "trivia",
    title: "Trivia Battle",
    description: "Preguntas rápidas, gana el más listo",
    icon: "🧠",
    color: "linear-gradient(135deg, #ffb347, #ffcc33)",
    path: "/trivia",
    status: "Próximamente"
  },
  {
    id: "reflex",
    title: "Reflex Game",
    description: "Pon a prueba tu velocidad de reacción",
    icon: "⚡",
    color: "linear-gradient(135deg, #ff4e50, #f9d423)",
    path: "/reflex",
    status: "Próximamente"
  }
];

export default function HomePage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
          background-attachment: fixed;
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
        }

        .page-wrapper {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }

        .header {
          text-align: center;
          margin-bottom: 50px;
          width: 100%;
          color: #fff;
        }

        .header h1 {
          font-size: clamp(2rem, 5vw, 3rem);
          margin-bottom: 10px;
          font-weight: 700;
        }

        .header p {
          opacity: 0.8;
          font-size: clamp(0.9rem, 2vw, 1.1rem);
        }

        .games-grid {
          width: 100%;
          max-width: 1400px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 25px;
          padding: 0 20px;
        }

        @media (min-width: 1600px) {
          .games-grid {
            max-width: 1600px;
            gap: 30px;
          }
        }

        @media (min-width: 768px) and (max-width: 1199px) {
          .games-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 767px) {
          .page-wrapper {
            padding: 20px 15px;
          }
          
          .header {
            margin-bottom: 30px;
          }
          
          .games-grid {
            grid-template-columns: 1fr;
            gap: 20px;
            padding: 0 10px;
          }
        }

        .game-card {
          position: relative;
          border-radius: 25px;
          padding: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          min-height: 250px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .game-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.25);
          z-index: 0;
        }

        .game-card > * {
          position: relative;
          z-index: 1;
        }

        .game-card:not(.disabled):hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
        }

        .game-card.disabled {
          filter: grayscale(100%);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .game-icon {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          margin-bottom: 15px;
        }

        .game-title {
          font-size: clamp(1.2rem, 3vw, 1.5rem);
          margin-bottom: 10px;
          color: #fff;
          font-weight: 600;
        }

        .game-description {
          font-size: clamp(0.85rem, 2vw, 0.95rem);
          opacity: 0.9;
          margin-bottom: 20px;
          flex-grow: 1;
          color: #fff;
        }

        .game-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: bold;
          align-self: flex-start;
        }

        .game-badge.available {
          background: rgba(0, 255, 136, 0.9);
          color: #000;
        }

        .game-badge.soon {
          background: rgba(255, 255, 255, 0.25);
          color: #fff;
        }
      `}</style>

      <div className="page-wrapper">
        <header className="header">
          <h1>🎮 MiniGames Hub</h1>
          <p>Elige un minijuego y compite con tus amigos</p>
        </header>

        <div className="games-grid">
          {games.map((game) => (
            <div
              key={game.id}
              className={`game-card ${game.status !== "Disponible" ? "disabled" : ""}`}
              style={{ background: game.color }}
              onClick={() => {
                if (game.status === "Disponible") {
                  router.push(game.path);
                }
              }}
            >
              <div className="game-icon">{game.icon}</div>
              <h2 className="game-title">{game.title}</h2>
              <p className="game-description">{game.description}</p>
              <span className={`game-badge ${game.status === "Disponible" ? "available" : "soon"}`}>
                {game.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}