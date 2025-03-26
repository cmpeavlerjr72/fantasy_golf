import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

const Draft = () => {
  const [draftState, setDraftState] = useState({
    players: [], // Original list
    sortedPlayers: [], // Available players
    teams: [],
    teamNames: [],
    currentTeam: 0,
    isDrafting: false,
    draftComplete: false,
    snakeDirection: 1,
  });
  const [leagueId, setLeagueId] = useState('');
  const [socket, setSocket] = useState(null);
  const [sortBy, setSortBy] = useState('owgr_rank');

  const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

  useEffect(() => {
    const newSocket = io(API_BASE_URL, { reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 });
    newSocket.on('connect', () => console.log('Socket connected successfully'));
    newSocket.on('connect_error', (err) => console.log('Socket connection error:', err.message));
    setSocket(newSocket);
    console.log('Socket initialized');

    return () => {
      newSocket.disconnect();
      console.log('Socket disconnected');
    };
  }, []);

  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (!selectedLeague) return;
    setLeagueId(selectedLeague);

    fetch(`${API_BASE_URL}/field`)
      .then((res) => res.json())
      .then((fieldData) => {
        const fieldPlayers = fieldData.field.map((p) => ({ id: p.dg_id, name: p.player_name }));
        fetch(`${API_BASE_URL}/rankings`)
          .then((res) => res.json())
          .then((rankingsData) => {
            const playersWithRankings = fieldPlayers.map((p) => {
              const match = rankingsData.rankings.find((r) => normalizeName(r.player_name) === normalizeName(p.name));
              return { ...p, owgr_rank: match?.owgr_rank || 1000, dg_rank: match?.datagolf_rank || 1000 };
            });
            const sorted = [...playersWithRankings].sort((a, b) => a.owgr_rank - b.owgr_rank);
            setDraftState((prev) => ({ ...prev, players: playersWithRankings, sortedPlayers: sorted }));
          });
      });

    fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
      .then((res) => res.json())
      .then((data) => setDraftState((prev) => ({ ...prev, teams: data.teams, teamNames: data.teamNames })));
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('draft-update', ({ leagueId: updateLeagueId, teamIndex, player }) => {
      console.log(`Received draft-update: leagueId=${updateLeagueId}, teamIndex=${teamIndex}, player=${player.name}, id=${player.id}`);
      if (updateLeagueId !== leagueId) return;

      setDraftState((prev) => {
        const updatedTeams = [...prev.teams];
        if (!updatedTeams[teamIndex].some((p) => p.id === player.id)) {
          updatedTeams[teamIndex] = [...updatedTeams[teamIndex], player];
        }
        const updatedPlayers = prev.sortedPlayers.filter((p) => p.id !== player.id);
        let nextTeam = prev.currentTeam + prev.snakeDirection;
        if (nextTeam >= prev.teams.length) {
          nextTeam = prev.teams.length - 1;
          return {
            ...prev,
            teams: updatedTeams,
            sortedPlayers: updatedPlayers,
            currentTeam: nextTeam,
            snakeDirection: -1,
            draftComplete: updatedTeams.every((t) => t.length === 6),
          };
        } else if (nextTeam < 0) {
          nextTeam = 0;
          return {
            ...prev,
            teams: updatedTeams,
            sortedPlayers: updatedPlayers,
            currentTeam: nextTeam,
            snakeDirection: 1,
            draftComplete: updatedTeams.every((t) => t.length === 6),
          };
        }
        console.log('Updated sortedPlayers:', updatedPlayers.map(p => ({ id: p.id, name: p.name })));
        return {
          ...prev,
          teams: updatedTeams,
          sortedPlayers: updatedPlayers,
          currentTeam: nextTeam,
          draftComplete: updatedTeams.every((t) => t.length === 6),
        };
      });
    });

    return () => socket.off('draft-update');
  }, [socket, leagueId]);

  const handleDraftPlayer = (playerIndex) => {
    if (!draftState.isDrafting || draftState.draftComplete || draftState.currentTeam === null || !socket) return;
    const player = draftState.sortedPlayers[playerIndex];
    console.log(`Emitting draft-pick: leagueId=${leagueId}, teamIndex=${draftState.currentTeam}, player=${player.name}`);
    socket.emit('draft-pick', { leagueId, teamIndex: draftState.currentTeam, player });
  };

  const handleSort = (criteria) => {
    setSortBy(criteria);
    setDraftState((prev) => ({
      ...prev,
      sortedPlayers: [...prev.sortedPlayers].sort((a, b) => a[criteria] - b[criteria]),
    }));
  };

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-6">
          <h2>Draft Your Team</h2>
          <div className="mb-3">
            <button
              className="btn btn-primary me-2"
              onClick={() => setDraftState((prev) => ({ ...prev, isDrafting: true }))}
              disabled={draftState.isDrafting || draftState.draftComplete}
            >
              Start Draft
            </button>
          </div>
          {draftState.draftComplete && <div className="alert alert-success">Draft Complete! All teams are full.</div>}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Available Players</h4>
            <div>
              <button className="btn btn-sm btn-secondary me-2" onClick={() => handleSort('owgr_rank')}>
                Sort by OWGR
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => handleSort('dg_rank')}>
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
              {draftState.sortedPlayers.map((player) => (
                <tr
                  key={player.id}
                  onClick={() => handleDraftPlayer(draftState.sortedPlayers.findIndex((p) => p.id === player.id))}
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
          {draftState.teams.map((team, teamIndex) => (
            <div key={teamIndex} className={`mb-4 ${draftState.currentTeam === teamIndex ? 'bg-light' : ''}`}>
              <h5>{draftState.teamNames[teamIndex]}</h5>
              <ul className="list-group">
                {team.map((player) => (
                  <li key={player.id} className="list-group-item">
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