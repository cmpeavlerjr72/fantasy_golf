import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

const Draft = () => {
  const [draftState, setDraftState] = useState({
    players: [],
    sortedPlayers: [],
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
  const [myTeam, setMyTeam] = useState(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [error, setError] = useState(null);

  const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

  // Initialize socket connection
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

  // Fetch initial data (players and league info)
  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (!selectedLeague) {
      setError('No league selected. Please select a league first.');
      setIsLoadingTeams(false);
      return;
    }
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
      })
      .catch((err) => {
        console.error('Error fetching player data:', err);
        setError('Failed to load player data.');
      });

    fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch league data');
        return res.json();
      })
      .then((data) => {
        console.log('Draft fetched league data:', data);
        setDraftState((prev) => ({ ...prev, teams: data.teams || [], teamNames: data.teamNames || [] }));
        setIsLoadingTeams(false);
      })
      .catch((err) => {
        console.error('Error fetching league data:', err);
        setError('Failed to load league data.');
        setIsLoadingTeams(false);
      });

    const storedTeam = localStorage.getItem('myTeam');
    if (storedTeam !== null && localStorage.getItem('teamAssignedInSession')) {
      setMyTeam(parseInt(storedTeam, 10));
    } else {
      localStorage.removeItem('myTeam');
      localStorage.removeItem('teamAssignedInSession');
    }
  }, []);

  // Handle socket events (team assignment, draft updates, and draft reset)
  useEffect(() => {
    if (!socket || !leagueId || myTeam === null) return;

    socket.emit('assign-team', { leagueId, teamIndex: myTeam });
    localStorage.setItem('myTeam', myTeam.toString());
    localStorage.setItem('teamAssignedInSession', 'true');

    socket.on('team-assigned', ({ success, message }) => {
      if (!success) {
        console.log('Team assignment failed:', message);
        setError(message);
        resetTeamSelection();
      }
    });

    socket.on('draft-reset', ({ leagueId: resetLeagueId }) => {
      if (resetLeagueId !== leagueId) return;
      console.log('Received draft-reset for league:', resetLeagueId);
      resetTeamSelection();
      setDraftState((prev) => ({
        ...prev,
        isDrafting: false,
        draftComplete: false,
        currentTeam: 0,
        snakeDirection: 1,
        teams: prev.teams.map(() => []),
      }));
    });

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

    return () => {
      socket.off('draft-update');
      socket.off('team-assigned');
      socket.off('draft-reset');
    };
  }, [socket, leagueId, myTeam]);

  const handleDraftPlayer = (playerIndex) => {
    if (!draftState.isDrafting || draftState.draftComplete || myTeam === null || myTeam !== draftState.currentTeam || !socket) {
      console.log('Draft blocked: Not your turn or invalid state');
      return;
    }
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

  const assignTeam = (teamIndex) => {
    setMyTeam(teamIndex);
    setDraftState((prev) => ({ ...prev, isDrafting: true })); // Start drafting after team selection
  };

  const resetTeamSelection = () => {
    setMyTeam(null);
    localStorage.removeItem('myTeam');
    localStorage.removeItem('teamAssignedInSession');
  };

  const handleStartDraft = () => {
    // Clear team selection and reset draft state
    resetTeamSelection();
    setDraftState((prev) => ({
      ...prev,
      isDrafting: false,
      draftComplete: false,
      currentTeam: 0,
      snakeDirection: 1,
      teams: prev.teams.map(() => []),
    }));
    // Notify server to clear team ownership
    if (socket) {
      socket.emit('start-draft', { leagueId });
    }
  };

  return (
    <div className="container">
      {myTeam === null ? (
        <div>
          <h2>Select Your Team</h2>
          {error ? (
            <div className="alert alert-danger">{error}</div>
          ) : isLoadingTeams ? (
            <p>Loading teams...</p>
          ) : draftState.teamNames.length === 0 ? (
            <div className="alert alert-warning">No teams available for this league.</div>
          ) : (
            <div>
              {draftState.teamNames.map((name, index) => (
                <button
                  key={index}
                  className="btn btn-primary me-2 mb-2"
                  onClick={() => assignTeam(index)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="row">
          <div className="col-md-6">
            <h2>Draft Your Team (Your Team: {draftState.teamNames[myTeam]})</h2>
            <div className="mb-3">
              <button
                className="btn btn-primary me-2"
                onClick={handleStartDraft}
                disabled={draftState.isDrafting || draftState.draftComplete}
              >
                Start Draft
              </button>
              <button
                className="btn btn-secondary"
                onClick={resetTeamSelection}
              >
                Change Team
              </button>
            </div>
            {draftState.draftComplete && <div className="alert alert-success">Draft Complete! All teams are full.</div>}
            {myTeam !== draftState.currentTeam && draftState.isDrafting && !draftState.draftComplete && (
              <div className="alert alert-info">Waiting for {draftState.teamNames[draftState.currentTeam]} to draft...</div>
            )}
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
                    style={{ cursor: myTeam === draftState.currentTeam && draftState.isDrafting ? 'pointer' : 'not-allowed' }}
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
      )}
    </div>
  );
};

export default Draft;