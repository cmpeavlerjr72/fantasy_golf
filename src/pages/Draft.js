import React, { useState, useEffect } from 'react';

const Draft = () => {
  const [players, setPlayers] = useState([]); // List of available players
  const [teams, setTeams] = useState([]); // Teams fetched from the server
  const [teamNames, setTeamNames] = useState([]); // Team names fetched from the server
  const [currentTeam, setCurrentTeam] = useState(0); // Track whose turn it is
  const [isDrafting, setIsDrafting] = useState(false); // Draft state
  const [draftComplete, setDraftComplete] = useState(false); // Track if draft is complete
  const [snakeDirection, setSnakeDirection] = useState(1); // Direction of the draft (1 = forward, -1 = backward)
  const [leagueId, setLeagueId] = useState(''); // Current league ID

  // Fetch player data and teams from the server
  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch players from player_data.json
      fetch('/player_data.json')
        .then((response) => response.json())
        .then((data) => {
          setPlayers(data.all.map((player) => ({
            id: player.id,
            golfer: player.golfer,
            rank: player.rank || 'N/A',
            odds: `${player.odds_numerator}/${player.odds_denominator}`,
          })));
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

  // Handle player selection
  const handleDraftPlayer = (playerIndex) => {
    if (!isDrafting || draftComplete) return;

    const selectedPlayer = players[playerIndex];

    // Add player to the current team
    const updatedTeams = [...teams];
    updatedTeams[currentTeam].push(selectedPlayer);

    // Remove player from the pool
    const updatedPlayers = players.filter((_, index) => index !== playerIndex);

    setPlayers(updatedPlayers);
    setTeams(updatedTeams);

    // Check if the draft is complete
    const allTeamsFull = updatedTeams.every((team) => team.length === 6);
    if (allTeamsFull) {
      setDraftComplete(true);

      // Save the drafted teams to the server
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

    // Update current team based on snake draft logic
    const nextTeam = currentTeam + snakeDirection;

    if (nextTeam >= teams.length) {
      // Reached the last team; reverse direction
      setSnakeDirection(-1);
      setCurrentTeam(teams.length - 1);
    } else if (nextTeam < 0) {
      // Reached the first team; reverse direction
      setSnakeDirection(1);
      setCurrentTeam(0);
    } else {
      // Move to the next team
      setCurrentTeam(nextTeam);
    }
  };

  return (
    <div className="container">
      <div className="row">
        {/* Left Column: Player Pool */}
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

          <h4>Available Players</h4>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>#</th>
                <th>Golfer</th>
                <th>Rank</th>
                <th>Odds</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr
                  key={index}
                  onClick={() => handleDraftPlayer(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{index + 1}</td>
                  <td>{player.golfer}</td>
                  <td>{player.rank}</td>
                  <td>{player.odds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column: Teams */}
        <div className="col-md-6">
          <h4>Teams</h4>
          {teams.map((team, teamIndex) => (
            <div
              key={teamIndex}
              className={`mb-4 ${currentTeam === teamIndex ? 'bg-light' : ''}`}
            >
              <h5>{teamNames[teamIndex]}</h5>
              <ul className="list-group">
                {team.map((player, index) => (
                  <li key={index} className="list-group-item">
                    {player.golfer}
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







