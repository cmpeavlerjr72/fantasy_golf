import React, { useState, useEffect } from 'react';
import './Scoreboard.css'; // Import the CSS file for styling

const Scoreboard = () => {
  const [leaderboard, setLeaderboard] = useState([]); // Player data
  const [error, setError] = useState(null); // Error handling
  const [loading, setLoading] = useState(true); // Loading state
  const [teams, setTeams] = useState({}); // Player-to-team mapping
  const [teamColors, setTeamColors] = useState({}); // Team colors
  const [teamNames, setTeamNames] = useState([]); // Team names
  const [leagueId, setLeagueId] = useState(''); // Current league ID

  useEffect(() => {
    const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

    // Fetch leaderboard data from the server
    fetch('http://localhost:5000/tournament-stats')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log('Fetched leaderboard data:', data); // Debugging
        if (!data.live_stats || !Array.isArray(data.live_stats)) {
          throw new Error('Invalid data structure: `live_stats` is missing or not an array.');
        }

        const players = data.live_stats.map((player) => ({
          id: player.dg_id,
          name: player.player_name,
          normalizedName: normalizeName(player.player_name),
          position: player.position || '-',
          scoreToPar: player.total || '-',
        }));
        setLeaderboard(players);
      })
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));

    // Fetch league data from the server
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);
      fetch(`http://localhost:5000/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          console.log('Fetched league data:', data); // Debugging
          const playerToTeamMap = {};
          data.teams.forEach((team, teamIndex) => {
            team.forEach((player) => {
              const normalizedPlayerName = normalizeName(player.name);
              playerToTeamMap[normalizedPlayerName] = data.teamNames[teamIndex];
            });
          });
          setTeams(playerToTeamMap);

          const uniqueColors = ['#FF9999', '#99CCFF', '#99FF99', '#FFFF99', '#CC99FF', '#FFCC99'];
          const teamColorsMap = {};
          data.teamNames.forEach((teamName, index) => {
            teamColorsMap[teamName] = uniqueColors[index % uniqueColors.length];
          });
          setTeamColors(teamColorsMap);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));
    }
  }, []);

  return (
    <div className="container masters-scoreboard">
      <h2 className="leaderboard-title">Masters Tournament Leaderboard</h2>
      {loading && <div>Loading leaderboard...</div>}
      {error && <div className="alert alert-danger">{`Error: ${error}`}</div>}
      {!loading && leaderboard.length > 0 ? (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Player</th>
              <th>Score to Par</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player) => {
              const teamName = teams[player.normalizedName];
              const rowStyle = { backgroundColor: teamColors[teamName] || 'white' };
              return (
                <tr key={player.id} style={rowStyle}>
                  <td>{player.position}</td>
                  <td>{player.name}</td>
                  <td>{player.scoreToPar}</td>
                  <td>{teamName || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        !loading && <div>No data available.</div>
      )}
    </div>
  );
};

export default Scoreboard;

















