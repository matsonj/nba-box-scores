import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

const fetchAndSaveSchedule = async () => {
  try {
    // Ensure schedule directory exists
    await fs.mkdir(SCHEDULE_DIR, { recursive: true });
    
    // Fetch schedule
    console.log('Fetching NBA schedule...');
    const response = await axios.get('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json');
    
    // Extract completed games
    const games = response.data.leagueSchedule.gameDates
      .flatMap((date: any) => date.games)
      .filter((game: any) => game.gameStatus === 3); // Only completed games
    
    console.log(`Found ${games.length} completed games`);
    
    // Save full schedule response
    const scheduleFile = path.join(SCHEDULE_DIR, 'schedule.json');
    await fs.writeFile(scheduleFile, JSON.stringify(response.data, null, 2));
    console.log(`Saved full schedule to ${scheduleFile}`);
    
    // Save completed games separately for easier access
    const completedGamesFile = path.join(SCHEDULE_DIR, 'completed-games.json');
    await fs.writeFile(completedGamesFile, JSON.stringify(games, null, 2));
    console.log(`Saved ${games.length} completed games to ${completedGamesFile}`);
    
    // Log first game to verify structure
    console.log('\nExample game structure:');
    console.log(JSON.stringify(games[0], null, 2));
    
  } catch (err) {
    console.error('Failed to fetch schedule:', err);
  }
};

fetchAndSaveSchedule();
