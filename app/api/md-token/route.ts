import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const mdToken = process.env.NEXT_PUBLIC_MOTHERDUCK_TOKEN;
        if (!mdToken) {
            throw new Error('MotherDuck token not found. Please set NEXT_PUBLIC_MOTHERDUCK_TOKEN in your .env.local file.');
        }
        return NextResponse.json({ mdToken });
    } catch (error) {
        console.error('Failed to get MotherDuck token:', error);
        return NextResponse.json({ error: 'Failed to get MotherDuck token' }, { status: 500 });
    }
}
