// This function fetches a MotherDuck token for the frontend to use to connect to MotherDuck.
export async function fetchMotherDuckToken(): Promise<string> {
  try {
    const response = await fetch('/api/get-token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error ${response.status}: ${errorBody}`);
    }

    const { token } = await response.json();
    if (!token) throw new Error('Invalid token response format');
    
    return token;
  } catch (error) {
    console.error('Token fetch error:', error);
    throw new Error('Failed to retrieve database credentials. Please refresh or contact support.');
  }
}
