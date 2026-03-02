import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import GameCard from '../GameCard';
import { ScheduleWithBoxScore } from '@/app/types/extended';

const makeGame = (overrides?: Partial<ScheduleWithBoxScore>): ScheduleWithBoxScore => ({
  game_id: '0022400100',
  game_date: new Date('2024-11-01T00:00:00Z'),
  home_team_id: 1610612747,
  away_team_id: 1610612738,
  home_team_abbreviation: 'LAL',
  away_team_abbreviation: 'BOS',
  home_team_score: 110,
  away_team_score: 105,
  status: 'Final',
  created_at: new Date('2024-11-02T00:00:00Z'),
  ...overrides,
});

describe('GameCard', () => {
  it('renders team abbreviations', () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getByText('LAL')).toBeInTheDocument();
    expect(screen.getByText('BOS')).toBeInTheDocument();
  });

  it('renders team scores', () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('105')).toBeInTheDocument();
  });

  it('renders period scores when provided', () => {
    const game = makeGame({
      periodScores: [
        { teamId: 'LAL', period: '1', points: 30 },
        { teamId: 'LAL', period: '2', points: 25 },
        { teamId: 'LAL', period: '3', points: 28 },
        { teamId: 'LAL', period: '4', points: 27 },
        { teamId: 'BOS', period: '1', points: 22 },
        { teamId: 'BOS', period: '2', points: 30 },
        { teamId: 'BOS', period: '3', points: 26 },
        { teamId: 'BOS', period: '4', points: 27 },
      ],
    });
    render(<GameCard game={game} />);
    // Period headers should be shown
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders OT column for overtime games', () => {
    const game = makeGame({
      periodScores: [
        { teamId: 'LAL', period: '5', points: 12 },
        { teamId: 'BOS', period: '5', points: 8 },
      ],
    });
    render(<GameCard game={game} />);
    expect(screen.getByText('OT')).toBeInTheDocument();
  });

  it('calls onGameSelect when clicked', () => {
    const handleSelect = jest.fn();
    render(<GameCard game={makeGame()} onGameSelect={handleSelect} />);
    fireEvent.click(screen.getByText('LAL').closest('div')!);
    expect(handleSelect).toHaveBeenCalledWith('0022400100');
  });

  it('renders loading spinner when loading prop is true', () => {
    const { container } = render(<GameCard game={makeGame()} loading={true} />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('does not render spinner when loading is false', () => {
    const { container } = render(<GameCard game={makeGame()} loading={false} />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });
});
