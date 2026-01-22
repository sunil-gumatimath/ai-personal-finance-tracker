export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );



    // We can't export the key directly in a standard way that looks like a hash string easily without raw export.
    // Instead of deriveKey (which is for encryption), let's use deriveBits to get the hash.

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        256 // 256 bits
    );

    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `$pbkdf2$100000$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Check if it's a valid PBKDF2 hash
    if (!storedHash.startsWith('$pbkdf2$')) {
        return false;
    }

    const parts = storedHash.split('$');
    // $pbkdf2$iterations$salt$hash
    // parts[0] = ""
    // parts[1] = "pbkdf2"
    // parts[2] = iterations
    // parts[3] = salt
    // parts[4] = hash

    if (parts.length !== 5) {
        return false;
    }

    const iterations = parseInt(parts[2], 10);
    const saltHex = parts[3];
    const originalHashHex = parts[4];

    const saltMatch = saltHex.match(/.{1,2}/g);
    if (!saltMatch) return false;
    const salt = new Uint8Array(saltMatch.map(byte => parseInt(byte, 16)));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === originalHashHex;
}
