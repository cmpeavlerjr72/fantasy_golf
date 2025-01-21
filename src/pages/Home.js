import React, { useState, useEffect } from 'react';
import './Home.css'; // Import the CSS file for styling

const Home = () => {
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [leagueId, setLeagueId] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Helper function to normalize names for consistent comparison
  const normalizeName = (name) => name?.toLowerCase().trim();

  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch league data
      fetch(`http://localhost:5000/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          setTeams(data.teams);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));

      // Fetch live tournament stats
      fetch('http://localhost:5000/tournament-stats')
        .then((response) => response.json())
        .then((data) => {
          if (data.live_stats && Array.isArray(data.live_stats)) {
            const normalizedLeaderboard = data.live_stats.map((player) => ({
              name: normalizeName(player.player_name),
              scoreToPar: parseFloat(player.total) || 0,
            }));
            setLeaderboard(normalizedLeaderboard);
          }
        })
        .catch((error) => console.error('Error fetching live tournament stats:', error));
    }
  }, []);

  // Fetch scorecard data when a player is selected
  const fetchScorecardData = (playerName) => {
    fetch('http://localhost:5000/holes')
      .then((response) => response.json())
      .then((data) => {
        const playerData = data.players.find(
          (player) => normalizeName(player.player_name) === normalizeName(playerName)
        );
        setSelectedPlayer(playerData || null);
      })
      .catch((error) => console.error('Error fetching scorecard data:', error));
  };

  // Calculate the total score for each team
  const calculateTeamScores = () => {
    return teamNames.map((teamName, index) => {
      const team = teams[index];
      const teamScore = team
        .map((player) => {
          const name = leaderboard.find(
            (entry) => normalizeName(entry.name) === normalizeName(player.name)
          );
          return name ? name.scoreToPar : null;
        })
        .filter((score) => score !== null) // Exclude players without scores
        .reduce((total, score) => total + score, 0); // Sum the scores
      return { teamName, score: teamScore };
    });
  };

  // Handle team card click
  const handleCardClick = (teamIndex) => {
    setSelectedTeam(selectedTeam === teamIndex ? null : teamIndex);
  };

  // Handle player click to fetch scorecard data
  const handlePlayerClick = (playerName) => {
    fetchScorecardData(playerName);
  };

  // Get styles for scores based on comparison with par
  const getScoreStyle = (score, par) => {
    const styles = {
      display: 'inline-block', // Ensures styling only wraps the score
      width: '24px',
      height: '24px',
      lineHeight: '24px', // Aligns text vertically
      textAlign: 'center',
      fontWeight: 'bold',
      // backgroundColor: '#ADD8E6', // Light blue background for consistency
      borderRadius: '0', // Default (no rounded edges)
    };
  
    if (score < par) {
      styles.color = 'red'; // Text color for scores under par
      if (score === par - 1) {
        styles.border = '2px solid black'; // Black outline for birdie
        styles.borderRadius = '50%'; // Circle for birdie
      } else if (score < par - 1) {
        styles.backgroundColor = 'white'; // Filled white circle for eagle or better
        styles.borderRadius = '50%';
      }
    } else if (score > par) {
      styles.color = 'green'; // Text color for scores over par
      if (score === par + 1) {
        styles.border = '2px solid black'; // Black outline for bogey
        styles.borderRadius = '0'; // Square for bogey
      } else if (score > par + 1) {
        styles.backgroundColor = 'white'; // Filled white square for double bogey or worse
        styles.borderRadius = '0';
      }
    } else if (score === par) {
      styles.color = 'green'; // Text color for par
    }
  
    return styles;
  };

  const sortedScores = calculateTeamScores().sort((a, b) => a.score - b.score);

  return (
    <div className="container">
      <h2>Welcome to League {leagueId}</h2>

      {/* Leaderboard */}
      <h4 className="mt-4">Team Leaderboard</h4>
      <table className="table table-striped table-bordered">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team Name</th>
            <th>Total Score</th>
          </tr>
        </thead>
        <tbody>
          {sortedScores.map((team, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{team.teamName}</td>
              <td>{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Team Cards */}
      <h4 className="mt-4">Teams</h4>
      <div className="row">
        {teams.map((team, index) => (
          <div className="col-md-4 mb-4" key={index}>
            <div
              className={`card ${selectedTeam === index ? 'bg-light' : ''}`}
              onClick={() => handleCardClick(index)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-body">
                <h5 className="card-title">{teamNames[index]}</h5>
                <p className="card-text">Click to view golfers</p>
              </div>
            </div>
            {selectedTeam === index && (
              <div className="mt-2">
                <ul className="list-group">
                  {team.map((player, playerIndex) => (
                    <li
                      key={playerIndex}
                      className="list-group-item"
                      onClick={() => handlePlayerClick(player.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {player.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Scorecard */}
      {selectedPlayer && (
        <div className="mt-4">
          <h4>Scorecard for {selectedPlayer.player_name}</h4>
          <table className="table table-bordered table-striped scorecard">
            <thead>
              <tr>
                <th>Round</th>
                {Array.from({ length: 18 }, (_, i) => (
                  <th key={i + 1}>Hole {i + 1}</th>
                ))}
                <th>OUT</th>
                <th>IN</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(selectedPlayer.rounds || []).map((round, roundIndex) => {
                const outScore = round.scores.slice(0, 9).reduce((sum, hole) => sum + hole.score, 0);
                const inScore = round.scores.slice(9).reduce((sum, hole) => sum + hole.score, 0);
                const totalScore = outScore + inScore;

                return (
                  <tr key={roundIndex}>
                    <td>Round {round.round_num}</td>
                    {round.scores.map((hole, holeIndex) => (
                      <td key={`hole-${holeIndex}`}>
                        <span style={getScoreStyle(hole.score, hole.par)}>{hole.score}</span>
                      </td>
                    ))}
                    <td>{outScore}</td>
                    <td>{inScore}</td>
                    <td>{totalScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Home;














