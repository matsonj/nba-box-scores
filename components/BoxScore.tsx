'use client';

import { useState } from 'react';
import { Team } from '@/types';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
}

export default function BoxScore({ homeTeam, awayTeam }: BoxScoreProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('FullGame');
  const periods = ['FullGame', '1', '2', '3', '4'];

  const renderTeamStats = (team: Team) => {
    if (!team.players || team.players.length === 0) {
      return <div>No player stats available</div>;
    }

    const periodPlayers = team.players.filter(player => player.period === selectedPeriod);

    if (periodPlayers.length === 0) {
      return <div>No stats available for this period</div>;
    }

    return (
      <div>
        <h3 className="font-bold text-lg mb-2">{team.teamAbbreviation}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Player</th>
                <th className="px-4 py-2 text-right">MIN</th>
                <th className="px-4 py-2 text-right">PTS</th>
                <th className="px-4 py-2 text-right">REB</th>
                <th className="px-4 py-2 text-right">AST</th>
                <th className="px-4 py-2 text-right">STL</th>
                <th className="px-4 py-2 text-right">BLK</th>
                <th className="px-4 py-2 text-right">TO</th>
                <th className="px-4 py-2 text-right">FG</th>
                <th className="px-4 py-2 text-right">3P</th>
                <th className="px-4 py-2 text-right">FT</th>
              </tr>
            </thead>
            <tbody>
              {periodPlayers.map((player, index) => (
                <tr key={player.player_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2">{player.player_name}</td>
                  <td className="px-4 py-2 text-right">{player.minutes}</td>
                  <td className="px-4 py-2 text-right">{player.points}</td>
                  <td className="px-4 py-2 text-right">{player.rebounds}</td>
                  <td className="px-4 py-2 text-right">{player.assists}</td>
                  <td className="px-4 py-2 text-right">{player.steals}</td>
                  <td className="px-4 py-2 text-right">{player.blocks}</td>
                  <td className="px-4 py-2 text-right">{player.turnovers}</td>
                  <td className="px-4 py-2 text-right">
                    {player.field_goals_made}-{player.field_goals_attempted}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {player.three_pointers_made}-{player.three_pointers_attempted}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {player.free_throws_made}-{player.free_throws_attempted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="period" className="mr-2">Period:</label>
        <select
          id="period"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {periods.map((period) => (
            <option key={period} value={period}>
              {period === 'FullGame' ? 'Full Game' : `Quarter ${period}`}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-8">
        {renderTeamStats(awayTeam)}
        {renderTeamStats(homeTeam)}
      </div>
    </div>
  );
}
