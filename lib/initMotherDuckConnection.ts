"use client"

import type { MDConnection } from "@motherduck/wasm-client"

// Create a connection to MotherDuck to be used in the frontend throughout a session.
export default async function initMotherDuckConnection(mdToken: string, database?: string): Promise<MDConnection> {
    if (typeof Worker === "undefined") {
        throw new Error("Web Workers are not supported in this environment.");
    }

    try {
        // Dynamically import MDConnection
        const motherduckWasmModule = await import("@motherduck/wasm-client");

        if (!motherduckWasmModule.MDConnection) {
            throw new Error("Failed to load MDConnection");
        }

        const _connection = motherduckWasmModule.MDConnection.create({ mdToken });

        // Wait for initialization to complete
        await _connection.isInitialized();

        if (database) {
            try {
                // Try to connect to the database
                await _connection.evaluateQuery(`USE ${database};`);
                console.log('Successfully connected to database:', database);
            } catch (error) {
                console.error(`Failed to use database ${database}:`, error);
                throw error;
            }
        }

        return _connection;
    } catch (error) {
        console.error("Failed to create DuckDB connection:", error);
        throw error;
    }
}
