import '@testing-library/jest-dom/vitest';

// The app renders Japanese dates and prices; pin the zone so snapshots of fee
// windows (08:00-20:00 etc.) are stable regardless of where the tests run.
process.env.TZ = 'Asia/Tokyo';
