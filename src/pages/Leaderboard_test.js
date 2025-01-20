import React, { useState, useEffect } from 'react';

const LeaderboardTest = () => {
  const [data, setData] = useState(null); // State for JSON data
  const [loading, setLoading] = useState(true); // State for loading status
  const [error, setError] = useState(null); // State for error handling

  useEffect(() => {
    // Fetch data from the JSON file
    fetch('http://localhost:5000/tournament-stats')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Fetched Data:', data); // Debugging: Log the fetched data
        setData(data); // Save the data to state
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setError(error.message);
      })
      .finally(() => setLoading(false)); // Ensure loading is set to false
  }, []);

  // Loading state
  if (loading) return <div>Loading...</div>;

  // Error state
  if (error) return <div>Error: {error}</div>;

  // Ensure data is defined before rendering
  if (!data || !data.live_stats) return <div>No data available.</div>;

  // Display data
  return (
    <div>
      <h2>Leaderboard Test</h2>
      {data.live_stats.length > 0 ? (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Position</th>
              <th>Player Name</th>
              <th>Total</th>
              <th>Thru</th>
            </tr>
          </thead>
          <tbody>
            {data.live_stats.map((player, index) => (
              <tr key={index}>
                <td>{player.position}</td>
                <td>{player.player_name}</td>
                <td>{player.total}</td>
                <td>{player.thru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No data available.</p>
      )}
    </div>
  );
};

export default LeaderboardTest;

