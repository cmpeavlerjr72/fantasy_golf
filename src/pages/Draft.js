import React, { useState, useEffect } from 'react';

const Draft = () => {
  const [players, setPlayers] = useState([]); // List of available players
  const [sortedPlayers, setSortedPlayers] = useState([]); // Sorted players
  const [sortBy, setSortBy] = useState('owgr_rank'); // Default sorting criteria
  const [teams, setTeams] = useState([]); // Teams fetched from the server
  const [teamNames, setTeamNames] = useState([]); // Team names fetched from the server
  const [currentTeam, setCurrentTeam] = useState(0); // Track whose turn it is
  const [isDrafting, setIsDrafting] = useState(false); // Draft state
  const [draftComplete, setDraftComplete] = useState(false); // Track if draft is complete
  const [snakeDirection, setSnakeDirection] = useState(1); // Direction of the draft (1 = forward, -1 = backward)
  const [leagueId, setLeagueId] = useState(''); // Current league ID

  useEffect(() => {
    const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch players from the field.json
      fetch('http://localhost:5000/field')
        .then((response) => response.json())
        .then((fieldData) => {
          const fieldPlayers = fieldData.field.map((player) => ({
            id: player.dg_id,
            name: player.player_name,
          }));

          // Fetch rankings from the rankings.json
          fetch('http://localhost:5000/rankings')
            .then((response) => response.json())
            .then((rankingsData) => {
              const playersWithRankings = fieldPlayers.map((player) => {
                const matchingRanking = rankingsData.rankings.find(
                  (ranking) =>
                    normalizeName(ranking.player_name) === normalizeName(player.name)
                );

                return {
                  ...player,
                  owgr_rank: matchingRanking?.owgr_rank || 1000,
                  dg_rank: matchingRanking?.datagolf_rank || 1000,
                };
              });

              // Sort by OWGR rank by default
              const sortedByOwgr = [...playersWithRankings].sort(
                (a, b) => (a.owgr_rank === 'N/A' ? 1 : b.owgr_rank === 'N/A' ? -1 : a.owgr_rank - b.owgr_rank)
              );
              setPlayers(playersWithRankings);
              setSortedPlayers(sortedByOwgr);
            })
            .catch((error) => console.error('Error fetching rankings data:', error));
        })
        .catch((error) => console.error('Error fetching player data:', error));

      // Fetch teams from the server
      fetch(`http://localhost:5000/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          setTeams(data.teams);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));
    }
  }, []);

  const handleDraftPlayer = (playerIndex) => {
    if (!isDrafting || draftComplete) return;

    const selectedPlayer = sortedPlayers[playerIndex];

    const updatedTeams = [...teams];
    updatedTeams[currentTeam].push(selectedPlayer);

    const updatedPlayers = sortedPlayers.filter((_, index) => index !== playerIndex);

    setSortedPlayers(updatedPlayers);
    setTeams(updatedTeams);

    const allTeamsFull = updatedTeams.every((team) => team.length === 6);
    if (allTeamsFull) {
      setDraftComplete(true);

      fetch(`http://localhost:5000/leagues/${leagueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams: updatedTeams,
          teamNames: teamNames,
        }),
      })
        .then(() => console.log('Draft saved successfully'))
        .catch((error) => console.error('Error saving draft:', error));

      return;
    }

    const nextTeam = currentTeam + snakeDirection;

    if (nextTeam >= teams.length) {
      setSnakeDirection(-1);
      setCurrentTeam(teams.length - 1);
    } else if (nextTeam < 0) {
      setSnakeDirection(1);
      setCurrentTeam(0);
    } else {
      setCurrentTeam(nextTeam);
    }
  };

  const handleSort = (criteria) => {
    setSortBy(criteria);
    const sorted = [...players].sort((a, b) => {
      if (criteria === 'owgr_rank') return a.owgr_rank - b.owgr_rank;
      if (criteria === 'dg_rank') return a.dg_rank - b.dg_rank;
      return 0;
    });
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










