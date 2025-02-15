// This function fetches a MotherDuck token for the frontend to use to connect to MotherDuck.
export async function fetchMotherDuckToken(): Promise<string> {
    const mdToken = process.env.NEXT_PUBLIC_MOTHERDUCK_TOKEN;
    if (!mdToken) {
        throw new Error('NEXT_PUBLIC_MOTHERDUCK_TOKEN environment variable is not set');
    }
    return mdToken;
}
