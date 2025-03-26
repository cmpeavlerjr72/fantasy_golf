import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

const Draft = () => {
  const [players, setPlayers] = useState([]); // Original player list
  const [sortedPlayers, setSortedPlayers] = useState([]); // Filtered list
  const [sortBy, setSortBy] = useState('owgr_rank');
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(0);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);
  const [snakeDirection, setSnakeDirection] = useState(1);
  const [leagueId, setLeagueId] = useState('');
  const [socket, setSocket] = useState(null);

  const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

  // Initialize socket
  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    newSocket.on('connect_error', (err) => {
      console.log('Socket connection error:', err.message);
    });
    setSocket(newSocket);
    console.log('Socket initialized');

    return () => {
      newSocket.disconnect();
      console.log('Socket disconnected');
    };
  }, []);

  // Fetch initial data (runs once)
  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (!selectedLeague) return;
    setLeagueId(selectedLeague);

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
            console.log('Initial sortedPlayers set:', sorted.length);
          });
      })
      .catch((err) => console.error('Error fetching player data:', err));

    fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams);
        setTeamNames(data.teamNames);
        console.log('Initial teams set:', data.teams);
      })
      .catch((err) => console.error('Error fetching league data:', err));
  }, []);

  // Socket listener for draft updates
  useEffect(() => {
    if (!socket) return;

    socket.on('draft-update', ({ leagueId: updateLeagueId, teamIndex, player }) => {
      console.log(`Received draft-update: leagueId=${updateLeagueId}, teamIndex=${teamIndex}, player=${player.name}, id=${player.id}`);

      if (updateLeagueId !== leagueId) {
        console.log(`Ignoring update: leagueId ${updateLeagueId} does not match ${leagueId}`);
        return;
      }

      // Update teams
      setTeams((prev) => {
        const updated = [...prev];
        if (!updated[teamIndex].some((p) => p.id === player.id)) {
          updated[teamIndex] = [...updated[teamIndex], player];
        }
        console.log('Updated teams:', updated);
        return updated;
      });

      // Remove player from sortedPlayers
      setSortedPlayers((prev) => {
        console.log('Before filter - sortedPlayers:', prev.map(p => ({ id: p.id, name: p.name })));
        const updated = prev.filter((p) => p.id !== player.id);
        console.log(`After filter - Removed ${player.name} (id=${player.id}). Remaining:`, updated.map(p => ({ id: p.id, name: p.name })));
        return updated;
      });

      // Update current team
      setCurrentTeam((prev) => {
        let next = prev + snakeDirection;
        if (next >= teams.length) {
          setSnakeDirection(-1);
          next = teams.length - 1;
        } else if (next < 0) {
          setSnakeDirection(1);
          next = 0;
        }
        console.log('Updated currentTeam:', next);
        return next;
      });

      // Check draft completion
      setDraftComplete((prev) => {
        const tempTeams = [...teams];
        if (!tempTeams[teamIndex].some((p) => p.id === player.id)) {
          tempTeams[teamIndex].push(player);
        }
        const complete = tempTeams.every((t) => t.length === 6);
        console.log('Draft complete:', complete);
        return complete;
      });
    });

    return () => {
      socket.off('draft-update');
    };
  }, [socket, teams.length, snakeDirection, leagueId]);

  const handleDraftPlayer = (playerIndex) => {
    if (!isDrafting || draftComplete || currentTeam === null || !socket) return;

    const player = sortedPlayers[playerIndex];
    console.log(`Emitting draft-pick: leagueId=${leagueId}, teamIndex=${currentTeam}, player=${player.name}, id=${player.id}`);
    socket.emit('draft-pick', { leagueId, teamIndex: currentTeam, player });
  };

  const handleSort = (criteria) => {
    setSortBy(criteria);
    setSortedPlayers((prev) => {
      const sorted = [...prev].sort((a, b) => a[criteria] - b[criteria]);
      console.log('Sorted sortedPlayers by', criteria, ':', sorted.map(p => ({ id: p.id, name: p.name })));
      return sorted;
    });
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
              {sortedPlayers.map((player) => (
                <tr
                  key={player.id}
                  onClick={() => handleDraftPlayer(sortedPlayers.findIndex((p) => p.id === player.id))}
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