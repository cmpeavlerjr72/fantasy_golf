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
  const [eventName, setEventName] = useState(''); // Event name
  const [fieldData, setFieldData] = useState([]); // Field data for tee times
  const [holesData, setHolesData] = useState(null); // Holes data for round info

  useEffect(() => {
    const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

    // Fetch tournament stats data
    fetch('http://localhost:5000/live-stats')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log('Fetched tournament stats:', data); // Debugging
        setEventName(data.event_name || 'Golf Tournament');

        if (!data.live_stats || !Array.isArray(data.live_stats)) {
          throw new Error('Invalid data structure: `live_stats` is missing or not an array.');
        }

        const players = data.live_stats.map((player) => ({
          id: player.dg_id,
          name: player.player_name,
          normalizedName: normalizeName(player.player_name),
          position: player.position || '-',
          scoreToPar: player.total || '-',
          thru: player.thru || '-', // Include the "thru" value
        }));
        setLeaderboard(players);
      })
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));

    // Fetch field data for tee times
    fetch('http://localhost:5000/field')
      .then((response) => response.json())
      .then((data) => setFieldData(data.field || []))
      .catch((error) => console.error('Error fetching field data:', error));

    // Fetch holes data
    fetch('http://localhost:5000/holes')
      .then((response) => response.json())
      .then((data) => setHolesData(data))
      .catch((error) => console.error('Error fetching holes data:', error));

    // Fetch league data
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

  const getThruOrTeeTime = (playerName, thru) => {
    if (thru < 18) {
      return thru; // Return the current "thru" value if less than 18
    }
  
    if (holesData && holesData.players) {
      const maxRoundNum = Math.max(
        ...holesData.players.flatMap((player) =>
          player.rounds?.map((round) => round.round_num) || []
        )
      );
  
      const player = fieldData.find((fieldPlayer) => fieldPlayer.player_name === playerName);
      if (player && player[`r${maxRoundNum + 1}_teetime`]) {
        return player[`r${maxRoundNum + 1}_teetime`];
      }
    }
  
    return 18; // Default to 18 if no tee time or data is available
  };

  return (
    <div className="container masters-scoreboard">
      <h2 className="leaderboard-title">{eventName} Leaderboard</h2>
      {loading && <div>Loading leaderboard...</div>}
      {error && <div className="alert alert-danger">{`Error: ${error}`}</div>}
      {!loading && leaderboard.length > 0 ? (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Player</th>
              <th>Score to Par</th>
              <th>Thru</th>
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
                  <td>{getThruOrTeeTime(player.name, player.thru)}</td>
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


