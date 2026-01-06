import { describe, expect, test } from "bun:test";
import { formatRelativeTime, formatTime, formatCurrentTime } from "./formatTime.ts";

describe("formatRelativeTime", () => {
    test("returns 'now' for timestamps less than 60 seconds ago", () => {
        const timestamp = Date.now() - 30 * 1000; // 30 seconds ago
        expect(formatRelativeTime(timestamp)).toBe("now");
    });

    test("returns 'now' for timestamps exactly 59 seconds ago", () => {
        const timestamp = Date.now() - 59 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("now");
    });

    test("returns '1m' for timestamps exactly 60 seconds ago", () => {
        const timestamp = Date.now() - 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("1m");
    });

    test("returns minutes format for timestamps 1-59 minutes ago", () => {
        const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
        expect(formatRelativeTime(timestamp)).toBe("5m");
    });

    test("returns '59m' for timestamps exactly 59 minutes ago", () => {
        const timestamp = Date.now() - 59 * 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("59m");
    });

    test("returns '1h' for timestamps exactly 60 minutes ago", () => {
        const timestamp = Date.now() - 60 * 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("1h");
    });

    test("returns hours format for timestamps 1-23 hours ago", () => {
        const timestamp = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
        expect(formatRelativeTime(timestamp)).toBe("3h");
    });

    test("returns '23h' for timestamps exactly 23 hours ago", () => {
        const timestamp = Date.now() - 23 * 60 * 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("23h");
    });

    test("returns '1d' for timestamps exactly 24 hours ago", () => {
        const timestamp = Date.now() - 24 * 60 * 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("1d");
    });

    test("returns days format for timestamps 1-6 days ago", () => {
        const timestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
        expect(formatRelativeTime(timestamp)).toBe("3d");
    });

    test("returns '6d' for timestamps exactly 6 days ago", () => {
        const timestamp = Date.now() - 6 * 24 * 60 * 60 * 1000;
        expect(formatRelativeTime(timestamp)).toBe("6d");
    });

    test("returns formatted date for timestamps 7+ days ago", () => {
        const timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
        const result = formatRelativeTime(timestamp);
        // Should match "Mon D" pattern like "Dec 27" or "Jan 5"
        expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
});

describe("formatTime", () => {
    test("formats morning time correctly", () => {
        const date = new Date();
        date.setHours(9, 30, 0, 0);
        expect(formatTime(date.getTime())).toBe("9:30 AM");
    });

    test("formats afternoon time correctly", () => {
        const date = new Date();
        date.setHours(14, 45, 0, 0);
        expect(formatTime(date.getTime())).toBe("2:45 PM");
    });

    test("formats noon correctly", () => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        expect(formatTime(date.getTime())).toBe("12:00 PM");
    });

    test("formats midnight correctly", () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        expect(formatTime(date.getTime())).toBe("12:00 AM");
    });

    test("formats single digit minutes with leading zero", () => {
        const date = new Date();
        date.setHours(8, 5, 0, 0);
        expect(formatTime(date.getTime())).toBe("8:05 AM");
    });
});

describe("formatCurrentTime", () => {
    test("returns time in H:MM AM/PM format", () => {
        const result = formatCurrentTime();
        // Should match patterns like "9:30 AM" or "12:45 PM"
        expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    test("returns a non-empty string", () => {
        const result = formatCurrentTime();
        expect(result.length).toBeGreaterThan(0);
    });
});
