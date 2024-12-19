import { useState } from 'react';
import { Team, Player } from '../types';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
}

interface PlayerStatsRowProps {
  player: Player;
  onClick: (player: Player) => void;
}

function PlayerStatsRow({ player, onClick }: PlayerStatsRowProps) {
  return (
    <tr 
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => onClick(player)}
    >
      <td className="px-4 py-2">{player.firstName} {player.lastName}</td>
      <td className="px-4 py-2">{player.stats.minutes}</td>
      <td className="px-4 py-2">{player.stats.points}</td>
      <td className="px-4 py-2">{player.stats.rebounds}</td>
      <td className="px-4 py-2">{player.stats.assists}</td>
      <td className="px-4 py-2">{`${player.stats.fieldGoalsMade}-${player.stats.fieldGoalsAttempted}`}</td>
      <td className="px-4 py-2">{`${player.stats.threePointersMade}-${player.stats.threePointersAttempted}`}</td>
      <td className="px-4 py-2">{`${player.stats.freeThrowsMade}-${player.stats.freeThrowsAttempted}`}</td>
    </tr>
  );
}

export default function BoxScore({ homeTeam, awayTeam }: BoxScoreProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player === selectedPlayer ? null : player);
  };

  return (
    <div className="space-y-6">
      {selectedPlayer ? (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              {selectedPlayer.firstName} {selectedPlayer.lastName}
            </h3>
            <button 
              onClick={() => setSelectedPlayer(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Minutes: {selectedPlayer.stats.minutes}</p>
              <p>Points: {selectedPlayer.stats.points}</p>
              <p>Rebounds: {selectedPlayer.stats.rebounds}</p>
              <p>Assists: {selectedPlayer.stats.assists}</p>
            </div>
            <div>
              <p>Steals: {selectedPlayer.stats.steals}</p>
              <p>Blocks: {selectedPlayer.stats.blocks}</p>
              <p>Turnovers: {selectedPlayer.stats.turnovers}</p>
              <p>FG: {selectedPlayer.stats.fieldGoalsMade}/{selectedPlayer.stats.fieldGoalsAttempted}</p>
              <p>3PT: {selectedPlayer.stats.threePointersMade}/{selectedPlayer.stats.threePointersAttempted}</p>
              <p>FT: {selectedPlayer.stats.freeThrowsMade}/{selectedPlayer.stats.freeThrowsAttempted}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-xl font-bold mb-2">{awayTeam.teamName}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Player</th>
                    <th className="px-4 py-2 text-left">MIN</th>
                    <th className="px-4 py-2 text-left">PTS</th>
                    <th className="px-4 py-2 text-left">REB</th>
                    <th className="px-4 py-2 text-left">AST</th>
                    <th className="px-4 py-2 text-left">FG</th>
                    <th className="px-4 py-2 text-left">3PT</th>
                    <th className="px-4 py-2 text-left">FT</th>
                  </tr>
                </thead>
                <tbody>
                  {awayTeam.players.map((player) => (
                    <PlayerStatsRow 
                      key={player.playerId}
                      player={player}
                      onClick={handlePlayerClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-2">{homeTeam.teamName}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Player</th>
                    <th className="px-4 py-2 text-left">MIN</th>
                    <th className="px-4 py-2 text-left">PTS</th>
                    <th className="px-4 py-2 text-left">REB</th>
                    <th className="px-4 py-2 text-left">AST</th>
                    <th className="px-4 py-2 text-left">FG</th>
                    <th className="px-4 py-2 text-left">3PT</th>
                    <th className="px-4 py-2 text-left">FT</th>
                  </tr>
                </thead>
                <tbody>
                  {homeTeam.players.map((player) => (
                    <PlayerStatsRow 
                      key={player.playerId}
                      player={player}
                      onClick={handlePlayerClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
