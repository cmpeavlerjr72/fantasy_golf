const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Path to the JSON file
const DB_FILE = './data/leagues.json';

// Utility to read the JSON file
const readDatabase = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ leagues: {} }, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error.message);
    return { leagues: {} };
  }
};

// Utility to write to the JSON file
const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log('Database updated successfully.');
  } catch (error) {
    console.error('Error writing to database:', error.message);
  }
};

// API: Get all leagues
app.get('/leagues', (req, res) => {
  const data = readDatabase();
  res.json(data.leagues);
});

// API: Get a specific league by ID
app.get('/leagues/:id', (req, res) => {
  const data = readDatabase();
  const league = data.leagues[req.params.id];
  if (!league) {
    console.error(`League with ID ${req.params.id} not found.`);
    return res.status(404).json({ error: 'League not found' });
  }
  res.json(league);
});

// API: Create a new league
app.post('/leagues', (req, res) => {
  try {
    const data = readDatabase();
    const { teams, teamNames } = req.body;

    // Determine the next league ID
    const existingIds = Object.keys(data.leagues).map(Number);
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    // Save the new league
    data.leagues[nextId] = { teams, teamNames };
    writeDatabase(data);

    console.log(`New league created with ID: ${nextId}`);
    res.status(201).json({ leagueId: nextId });
  } catch (error) {
    console.error('Error creating league:', error.message);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// API: Update an existing league
app.put('/leagues/:id', (req, res) => {
  try {
    const data = readDatabase();
    const league = data.leagues[req.params.id];
    if (!league) {
      console.error(`League with ID ${req.params.id} not found.`);
      return res.status(404).json({ error: 'League not found' });
    }

    // Update league data
    data.leagues[req.params.id] = { ...league, ...req.body };
    writeDatabase(data);

    console.log(`League with ID ${req.params.id} updated.`);
    res.json(data.leagues[req.params.id]);
  } catch (error) {
    console.error('Error updating league:', error.message);
    res.status(500).json({ error: 'Failed to update league' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

