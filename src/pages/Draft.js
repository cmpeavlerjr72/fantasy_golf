import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('https://golf-server-0fea.onrender.com'); // Adjust if needed

const Draft = () => {
  const [players, setPlayers] = useState([]);
  const [sortedPlayers, setSortedPlayers] = useState([]);
  const [sortBy, setSortBy] = useState('owgr_rank');
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(0);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);
  const [snakeDirection, setSnakeDirection] = useState(1);
  const [leagueId, setLeagueId] = useState('');

  const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

  const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (!selectedLeague) return;
    setLeagueId(selectedLeague);

    // Fetch player data
    fetch(`${API_BASE_URL}/field`)
      .then((res) => res.json())
      .then((fieldData) => {
        const fieldPlayers = fieldData.field.map((p) => ({
          id: p.dg_id,
          name: p.player_name,
        }));

        fetch(`${API_BASE_URL}/rankings`)
          .then((res) => res.json())
          .then((rankingsData) => {
            const playersWithRankings = fieldPlayers.map((p) => {
              const match = rankingsData.rankings.find(
                (r) => normalizeName(r.player_name) === normalizeName(p.name)
              );
              return {
                ...p,
                owgr_rank: match?.owgr_rank || 1000,
                dg_rank: match?.datagolf_rank || 1000,
              };
            });

            const sorted = [...playersWithRankings].sort((a, b) => a.owgr_rank - b.owgr_rank);
            setPlayers(playersWithRankings);
            setSortedPlayers(sorted);
          });
      });

    // Fetch league data
    fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams);
        setTeamNames(data.teamNames);
      });

    // Socket listener
    socket.on('updateDraft', ({ leagueId: updateLeagueId, teams, sortedPlayers, currentTeam, snakeDirection, draftComplete }) => {
      if (updateLeagueId !== selectedLeague) return;
      setTeams(teams);
      setSortedPlayers(sortedPlayers);
      setCurrentTeam(currentTeam);
      setSnakeDirection(snakeDirection);
      setDraftComplete(draftComplete);
    });

    return () => {
      socket.off('updateDraft');
    };
  }, []);

  const handleDraftPlayer = (playerIndex) => {
    if (!isDrafting || draftComplete || currentTeam === null) return;

    const player = sortedPlayers[playerIndex];
    socket.emit('draftPlayer', {
      leagueId,
      player,
      currentTeam,
      sortedPlayers,
      teams,
      teamNames,
      snakeDirection,
    });
  };

  const handleSort = (criteria) => {
    setSortBy(criteria);
    const sorted = [...players].sort((a, b) => a[criteria] - b[criteria]);
    setSortedPlayers(sorted);
  };

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-6">
          <h2>Draft Your Team</h2>
          <div className="mb-3">
            <button
              className="btn btn-primary me-2"
              onClick={() => setIsDrafting(true)}
              disabled={isDrafting || draftComplete}
            >
              Start Draft
            </button>
          </div>

          {draftComplete && (
            <div className="alert alert-success">Draft Complete! All teams are full.</div>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Available Players</h4>
            <div>
              <button
                className="btn btn-sm btn-secondary me-2"
                onClick={() => handleSort('owgr_rank')}
              >
                Sort by OWGR
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleSort('dg_rank')}
              >
                Sort by DG Rank
              </button>
            </div>
          </div>

          <table className="table table-striped">
            <thead>
              <tr>
                <th>OWGR Rank</th>
                <th>DG Rank</th>
                <th>Player</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr
                  key={index}
                  onClick={() => handleDraftPlayer(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{player.owgr_rank}</td>
                  <td>{player.dg_rank}</td>
                  <td>{player.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="col-md-6">
          <h4>Teams</h4>
          {teams.map((team, teamIndex) => (
            <div key={teamIndex} className={`mb-4 ${currentTeam === teamIndex ? 'bg-light' : ''}`}>
              <h5>{teamNames[teamIndex]}</h5>
              <ul className="list-group">
                {team.map((player, index) => (
                  <li key={index} className="list-group-item">
                    {player.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Draft;
