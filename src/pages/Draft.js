import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './Draft.css'; // Assuming you have a Draft.css file for styling

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
  const [sortDirection, setSortDirection] = useState(1); // 1 for ascending, -1 for descending
  const [myTeam, setMyTeam] = useState(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [error, setError] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [shotsGainedStats, setShotsGainedStats] = useState([]); // State for Shots Gained stats
  const [statRanges, setStatRanges] = useState({}); // Store min/max ranges for each SG stat

  const normalizeName = (name) => name?.toLowerCase().trim();

  // Function to calculate background color based on value and range
  const getBackgroundColor = (value, minValue, maxValue) => {
    if (value === null || value === undefined || minValue === maxValue) return 'transparent';
    if (value < 0) return 'rgba(255, 99, 71, 0.2)'; // Light red for negative values
    const ratio = (value - minValue) / (maxValue - minValue);
    const rStart = 240, gStart = 255, bStart = 240;
    const rEnd = 34, gEnd = 139, bEnd = 34;
    const r = Math.round(rStart + (rEnd - rStart) * ratio);
    const g = Math.round(gStart + (gEnd - gStart) * ratio);
    const b = Math.round(bStart + (bEnd - bStart) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

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

  // Fetch initial data, SG stats, and check draft status
  useEffect(() => {
    // Fetch Shots Gained stats
    fetch(`${API_BASE_URL}/sg-stats`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch Shots Gained stats: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Shots Gained stats received:', data);
        if (data.players && Array.isArray(data.players)) {
          const normalizedStats = data.players.map((player) => ({
            dg_id: player.dg_id,
            player_name: normalizeName(player.player_name),
            sg_putt: player.sg_putt,
            sg_arg: player.sg_arg,
            sg_app: player.sg_app,
            sg_ott: player.sg_ott,
            sg_total: player.sg_total,
            driving_acc: player.driving_acc,
            driving_dist: player.driving_dist,
          }));
          setShotsGainedStats(normalizedStats);

          // Calculate min/max ranges for each SG stat
          const statsToCalculate = [
            'sg_putt',
            'sg_arg',
            'sg_app',
            'sg_ott',
            'sg_total',
            'driving_acc',
            'driving_dist',
          ];
          const ranges = {};
          statsToCalculate.forEach((stat) => {
            const values = normalizedStats
              .map((player) => player[stat])
              .filter((val) => val !== null && val !== undefined);
            ranges[stat] = {
              min: values.length > 0 ? Math.min(...values) : 0,
              max: values.length > 0 ? Math.max(...values) : 0,
            };
          });
          setStatRanges(ranges);
          console.log('Stat ranges calculated:', ranges);
        } else {
          console.error('Shots Gained stats data is not in the expected format:', data);
        }
      })
      .catch((error) => {
        console.error('Error fetching Shots Gained stats:', error.message);
        alert(`Error fetching Shots Gained stats: ${error.message}`);
      });

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
      setError('Draft blocked: Not your turn or invalid state.');
      return;
    }
    console.log('Drafting player:', player);
    console.log(`Emitting draft-pick: leagueId=${leagueId}, teamIndex=${myTeam}, player=${player.name}`);
    socket.emit('draft-pick', { leagueId, teamIndex: myTeam, player });
  };

  const handleSort = (criteria) => {
    // Toggle sort direction if the same column is clicked again
    const newSortDirection = sortBy === criteria ? sortDirection * -1 : 1;
    setSortBy(criteria);
    setSortDirection(newSortDirection);

    setDraftState((prev) => {
      const sortedPlayers = [...prev.availablePlayers].sort((a, b) => {
        // Handle sorting for player stats (OWGR and DG ranks)
        if (criteria === 'owgr_rank' || criteria === 'dg_rank') {
          const aValue = a[criteria] || 0;
          const bValue = b[criteria] || 0;
          return (aValue - bValue) * newSortDirection;
        }

        // Handle sorting for player name (alphabetical)
        if (criteria === 'name') {
          return a.name.localeCompare(b.name) * newSortDirection;
        }

        // Handle sorting for Shots Gained stats
        const aStat = shotsGainedStats.find((stat) => String(stat.dg_id) === String(a.id));
        const bStat = shotsGainedStats.find((stat) => String(stat.dg_id) === String(b.id));
        const aValue = aStat ? aStat[criteria] || 0 : -Infinity; // Use -Infinity for players without stats to sort them to the bottom
        const bValue = bStat ? bStat[criteria] || 0 : -Infinity;
        return (aValue - bValue) * newSortDirection;
      });

      return { ...prev, availablePlayers: sortedPlayers };
    });
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
            {error && <div className="alert alert-danger">{error}</div>}
            {draftState.draftComplete && <div className="alert alert-success">Draft Complete! All teams are full.</div>}
            {draftState.isDrafting && !draftState.draftComplete && (
              myTeam === draftState.currentTeamIndex ? (
                <div className="alert alert-success">It's your turn!</div>
              ) : (
                <div className="alert alert-info">Waiting for {draftState.teamNames[draftState.currentTeamIndex]} to draft...</div>
              )
            )}
            <div className="mb-3">
              <h4>Available Players</h4>
            </div>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('owgr_rank')}>
                    OWGR Rank {sortBy === 'owgr_rank' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dg_rank')}>
                    DG Rank {sortBy === 'dg_rank' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Player {sortBy === 'name' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sg_putt')}>
                    SG Putt {sortBy === 'sg_putt' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sg_arg')}>
                    SG Around Green {sortBy === 'sg_arg' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sg_app')}>
                    SG Approach {sortBy === 'sg_app' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sg_ott')}>
                    SG Off Tee {sortBy === 'sg_ott' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sg_total')}>
                    SG Total {sortBy === 'sg_total' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('driving_acc')}>
                    Driving Accuracy {sortBy === 'driving_acc' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('driving_dist')}>
                    Driving Distance {sortBy === 'driving_dist' && (sortDirection === 1 ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {draftState.availablePlayers.map((player) => {
                  // Find the player's Shots Gained stats by matching dg_id
                  const playerStats = shotsGainedStats.find(
                    (stat) => String(stat.dg_id) === String(player.id)
                  );
                  return (
                    <tr
                      key={player.id}
                      onClick={() => handleDraftPlayer(player)}
                      style={{ cursor: myTeam === draftState.currentTeamIndex && draftState.isDrafting ? 'pointer' : 'not-allowed' }}
                    >
                      <td>{player.owgr_rank}</td>
                      <td>{player.dg_rank}</td>
                      <td>{player.name}</td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.sg_putt, statRanges.sg_putt?.min, statRanges.sg_putt?.max) : 'transparent' }}>
                        {playerStats ? playerStats.sg_putt.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.sg_arg, statRanges.sg_arg?.min, statRanges.sg_arg?.max) : 'transparent' }}>
                        {playerStats ? playerStats.sg_arg.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.sg_app, statRanges.sg_app?.min, statRanges.sg_app?.max) : 'transparent' }}>
                        {playerStats ? playerStats.sg_app.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.sg_ott, statRanges.sg_ott?.min, statRanges.sg_ott?.max) : 'transparent' }}>
                        {playerStats ? playerStats.sg_ott.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.sg_total, statRanges.sg_total?.min, statRanges.sg_total?.max) : 'transparent' }}>
                        {playerStats ? playerStats.sg_total.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.driving_acc, statRanges.driving_acc?.min, statRanges.driving_acc?.max) : 'transparent' }}>
                        {playerStats ? playerStats.driving_acc.toFixed(3) : 'N/A'}
                      </td>
                      <td style={{ backgroundColor: playerStats ? getBackgroundColor(playerStats.driving_dist, statRanges.driving_dist?.min, statRanges.driving_dist?.max) : 'transparent' }}>
                        {playerStats ? playerStats.driving_dist.toFixed(3) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
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