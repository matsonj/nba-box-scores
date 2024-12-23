# NBA Box Scores

A Next.js application for fetching, storing, and analyzing NBA box score data. This project provides a comprehensive pipeline for collecting game schedules and box scores, storing them in a DuckDB database, and presenting the data through a web interface.

## Project Overview

This application allows you to:
- Fetch NBA game schedules and box scores
- Store game data in a DuckDB database
- Generate and maintain data schemas
- Query and analyze game statistics
- View data through a web interface

## Data Pipeline

The data pipeline consists of several steps that must be executed in order:

1. **Fetch Game Schedule**
```bash
npm run fetch-schedule
```

2. **Load Schedule into Database**
```bash
npm run load-schedule
```

3. **Fetch Box Scores**
```bash
npm run fetch-box-scores
```

4. **Load Box Scores into Database**
```bash
npm run load-box-scores
```

5. **Generate Schemas (Optional)**
```bash
npm run generate-schemas
```
Only needed when there are changes to the underlying data schema.

## Application Pages

The application consists of two main pages:

### Home Page (`app/page.tsx`)
The home page displays a chronological list of NBA games with their scores and status. It:
- Fetches both schedule and box score data in parallel
- Groups games by date for easy navigation
- Shows game status, period information, and scores
- Provides links to detailed box scores for each game

### Game Details Page (`app/game/[gameId]/page.tsx`)
This dynamic route shows detailed statistics for a specific game. Features include:
- Complete box score with player statistics
- Team totals and shooting percentages
- Player performance metrics (points, rebounds, assists, etc.)
- Starter vs bench player differentiation
- Period-by-period scoring breakdown

## Development

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a custom font for Vercel.
