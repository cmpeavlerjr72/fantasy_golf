import React, { useState, useEffect } from 'react';
import './Scoreboard.css'; // Import the CSS file for styling

const Scoreboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState({});
  const [teamColors, setTeamColors] = useState({});
  const [teamNames, setTeamNames] = useState([]);
  const [leagueId, setLeagueId] = useState('');

  useEffect(() => {
    const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

    // Fetch leaderboard data
    fetch(`${process.env.PUBLIC_URL}/leaderboard.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!data.data || !Array.isArray(data.data.player)) {
          throw new Error('Invalid data structure: `data.player` is missing or not an array.');
        }

        const players = data.data.player.map((player) => ({
          id: player.id,
          name: `${player.first_name} ${player.last_name}`,
          normalizedName: normalizeName(`${player.first_name} ${player.last_name}`),
          position: player.pos || '-',
          scoreToPar: player.topar || '-',
          movement: player.movement || '-',
          country: player.countryName || '-',
        }));
        setLeaderboard(players);
      })
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));

    // Fetch league data
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);
      fetch(`http://localhost:5000/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          const playerToTeamMap = {};
          data.teams.forEach((team, teamIndex) => {
            team.forEach((player) => {
              const normalizedPlayerName = normalizeName(player.golfer);
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
              <th>Movement</th>
              <th>Country</th>
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
                  <td>{player.movement > 0 ? `+${player.movement}` : player.movement}</td>
                  <td>{player.country}</td>
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
















