export function debugLog(label: string, data: any) {
    console.group(`DEBUG: ${label}`);
    console.log(data); // Log the raw data first
    
    // Also log a stringified version with BigInt handling
    const seen = new WeakSet();
    const replacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    };
    
    try {
        console.log('Stringified:', JSON.stringify(data, replacer, 2));
    } catch (e) {
        console.log('Could not stringify data:', e);
    }
    
    console.groupEnd();
    return data; // Return data for chaining
}
