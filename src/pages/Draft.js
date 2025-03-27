import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

const Draft = () => {
  const [draftState, setDraftState] = useState({
    teams: [],
    teamNames: [],
    availablePlayers: [],
    currentTeamIndex: 0,
    snakeDirection: 1,
    isDrafting: false,
    draftComplete: false,
  });
  const [leagueId, setLeagueId] = useState('');
  const [socket, setSocket] = useState(null);
  const [sortBy, setSortBy] = useState('owgr_rank');
  const [myTeam, setMyTeam] = useState(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [error, setError] = useState(null);
  const [pinInput, setPinInput] = useState('');

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

  // Fetch initial data and check draft status
  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (!selectedLeague) {
      setError('No league selected. Please select a league first.');
      setIsLoadingTeams(false);
      return;
    }
    setLeagueId(selectedLeague);

    // Clear local team selection on page load
    setMyTeam(null);
    localStorage.removeItem('myTeam');
    localStorage.removeItem('teamAssignedInSession');

    fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch league data');
        return res.json();
      })
      .then((data) => {
        console.log('Draft fetched league data:', data);
        setDraftState((prev) => ({
          ...prev,
          teams: data.teams || [],
          teamNames: data.teamNames || [],
          availablePlayers: data.availablePlayers || [],
          currentTeamIndex: data.currentTeamIndex || 0,
          snakeDirection: data.snakeDirection || 1,
          isDrafting: data.isDrafting || false,
          draftComplete: data.draftComplete || false,
        }));
        setIsLoadingTeams(false);
      })
      .catch((err) => {
        console.error('Error fetching league data:', err);
        setError('Failed to load league data.');
        setIsLoadingTeams(false);
      });

    if (socket) {
      socket.emit('join-draft', { leagueId: selectedLeague });
    }
  }, [socket]);

  // Handle socket events
  useEffect(() => {
    if (!socket || !leagueId) return;

    socket.on('draft-status', (draftStatus) => {
      if (draftStatus.error) {
        setError(draftStatus.error);
        return;
      }

      console.log('Received draft-status:', draftStatus);
      setDraftState({
        teams: draftStatus.teams || [],
        teamNames: draftStatus.teamNames || [],
        availablePlayers: draftStatus.availablePlayers || [],
        currentTeamIndex: draftStatus.currentTeamIndex || 0,
        snakeDirection: draftStatus.snakeDirection || 1,
        isDrafting: draftStatus.isDrafting || false,
        draftComplete: draftStatus.draftComplete || false,
      });
    });

    if (myTeam !== null) {
      socket.emit('assign-team', { leagueId, teamIndex: myTeam });
      localStorage.setItem('myTeam', myTeam.toString());
      localStorage.setItem('teamAssignedInSession', 'true');
    }

    socket.on('team-assigned', ({ success, message, teamIndex }) => {
      if (!success) {
        console.log('Team assignment failed:', message);
        setError(message);
        resetTeamSelection();
      } else {
        setMyTeam(teamIndex);
        setError(null);
      }
    });

    socket.on('draft-update', ({ leagueId: updateLeagueId, teams, availablePlayers, currentTeamIndex, snakeDirection, isDrafting, draftComplete }) => {
      if (updateLeagueId !== leagueId) return;
      console.log(`Received draft-update: leagueId=${updateLeagueId}, currentTeamIndex=${currentTeamIndex}`);

      setDraftState((prev) => ({
        ...prev,
        teams: teams || prev.teams,
        availablePlayers: availablePlayers || prev.availablePlayers,
        currentTeamIndex: currentTeamIndex || 0,
        snakeDirection: snakeDirection || 1,
        isDrafting: isDrafting || false,
        draftComplete: draftComplete || false,
      }));
    });

    return () => {
      socket.off('draft-status');
      socket.off('draft-update');
      socket.off('team-assigned');
    };
  }, [socket, leagueId, myTeam]);

  const handleDraftPlayer = (player) => {
    if (!draftState.isDrafting || draftState.draftComplete || myTeam === null || myTeam !== draftState.currentTeamIndex || !socket) {
      console.log('Draft blocked: Not your turn or invalid state');
      return;
    }
    console.log('Drafting player:', player);
    console.log(`Emitting draft-pick: leagueId=${leagueId}, teamIndex=${myTeam}, player=${player.name}`);
    socket.emit('draft-pick', { leagueId, teamIndex: myTeam, player });
  };

  const handleSort = (criteria) => {
    setSortBy(criteria);
    setDraftState((prev) => ({
      ...prev,
      availablePlayers: [...prev.availablePlayers].sort((a, b) => a[criteria] - b[criteria]),
    }));
  };

  const assignTeam = (teamIndex) => {
    setMyTeam(teamIndex);
  };

  const resetTeamSelection = () => {
    setMyTeam(null);
    localStorage.removeItem('myTeam');
    localStorage.removeItem('teamAssignedInSession');
    setPinInput('');
  };

  const handleStartDraft = () => {
    socket.emit('start-draft', { leagueId });
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{2}$/.test(pinInput)) {
      setError('Please enter a valid two-digit PIN (e.g., "01", "02").');
      return;
    }

    const teamIndex = parseInt(pinInput, 10) - 1;
    if (teamIndex < 0 || teamIndex >= draftState.teamNames.length) {
      setError(`Invalid PIN. Please enter a PIN between "01" and "${draftState.teamNames.length.toString().padStart(2, '0')}".`);
      return;
    }

    setError(null);
    assignTeam(teamIndex);
  };

  return (
    <div className="container">
      {myTeam === null ? (
        <div>
          <h2>Select Your Team</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          {isLoadingTeams ? (
            <p>Loading teams...</p>
          ) : draftState.teamNames.length === 0 ? (
            <div className="alert alert-warning">No teams available for this league.</div>
          ) : draftState.draftComplete ? (
            <div className="alert alert-success">
              Draft is already complete! You cannot modify the teams.
            </div>
          ) : (
            <div>
              <p>Available teams:</p>
              <ul>
                {draftState.teamNames.map((name, index) => (
                  <li key={index}>
                    PIN: {(index + 1).toString().padStart(2, '0')} - Team: {name}
                  </li>
                ))}
              </ul>
              <form onSubmit={handlePinSubmit}>
                <div className="mb-3">
                  <label htmlFor="pinInput" className="form-label">
                    Enter your team PIN (e.g., "01" for {draftState.teamNames[0]})
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="pinInput"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN (e.g., 01)"
                    maxLength="2"
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Submit PIN
                </button>
              </form>
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
            {draftState.isDrafting && !draftState.draftComplete && (
              myTeam === draftState.currentTeamIndex ? (
                <div className="alert alert-success">It's your turn!</div>
              ) : (
                <div className="alert alert-info">Waiting for {draftState.teamNames[draftState.currentTeamIndex]} to draft...</div>
              )
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
                {draftState.availablePlayers.map((player) => (
                  <tr
                    key={player.id}
                    onClick={() => handleDraftPlayer(player)}
                    style={{ cursor: myTeam === draftState.currentTeamIndex && draftState.isDrafting ? 'pointer' : 'not-allowed' }}
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
              <div
                key={teamIndex}
                className={`mb-4 p-2 rounded ${draftState.currentTeamIndex === teamIndex ? 'active-team' : ''}`}
                style={
                  draftState.currentTeamIndex === teamIndex
                    ? { backgroundColor: '#4a90e2' }
                    : {}
                }
              >
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