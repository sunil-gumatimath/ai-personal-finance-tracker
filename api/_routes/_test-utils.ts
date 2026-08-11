/**
 * Test harness for API route handlers.
 *
 * Routes are tested through their `ApiRequest`/`ApiResponse` contract:
 * auth gate, method dispatch, and error mapping are exercised against
 * mocked auth + service modules so no database is required.
 *
 * IMPORTANT: `mock.module` must be registered BEFORE the route module is
 * imported, so each test file calls `mockAuth`/`mockService` first and only
 * then does `await import("./x.routes.js")`.
 */
import { mock } from "bun:test";
import type { ApiRequest, ApiResponse } from "../_utils/types.js";

export type CapturedResponse = {
	statusCode: number;
	body: unknown;
	headers: Record<string, string | string[]>;
};

/** Response double that records status/body/headers instead of writing to HTTP. */
export function makeResponse(): {
	res: ApiResponse;
	captured: CapturedResponse;
} {
	const captured: CapturedResponse = {
		statusCode: 200,
		body: undefined,
		headers: {},
	};

	const res: ApiResponse = {
		status(code) {
			captured.statusCode = code;
			return this;
		},
		json(data) {
			captured.body = data;
			return this;
		},
		setHeader(key, value) {
			captured.headers[key] = Array.isArray(value) ? value.join(", ") : value;
			return this;
		},
		end(data) {
			captured.body = data === undefined ? "" : data;
			return this;
		},
	};

	return { res, captured };
}

export function makeRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
	return {
		method: "GET",
		body: {},
		headers: {},
		query: {},
		...overrides,
	};
}

/**
 * Replace the auth service so `getAuthedUserId` returns a controllable value.
 * Returns the mock so tests can switch implementations (e.g. 401 vs 200).
 *
 * The factory also provides the other exports routes import (auth.routes.ts
 * pulls session-cookie helpers and the auth client), so a mock registered by
 * ANY test file can never break another route's import — Bun workers reuse
 * one process for several test files, and mock.module registrations from an
 * earlier file can be the ones in effect when a later file's route module is
 * first imported.
 */
export function mockAuth(initialUserId: string | null) {
	const getAuthedUserId = mock(async () => initialUserId);
	const benign = (fn: (...args: never[]) => unknown) => mock(fn as never);
	mock.module("../_services/auth.service.js", () => ({
		getAuthedUserId,
		getAuthOrigin: benign(() => "https://example.com"),
		getRequestToken: benign(() => "tok-1"),
		buildSessionCookie: benign(() => "pft_session=; HttpOnly"),
		buildClearedSessionCookie: benign(() => "pft_session=; Max-Age=0"),
		authClient: {
			signIn: { email: benign(async () => ({ data: null, error: null })) },
			signUp: { email: benign(async () => ({ data: null, error: null })) },
		},
	}));
	return getAuthedUserId;
}

/**
 * Replace a route's service module with fake implementations.
 * Pass the module path exactly as the route imports it (e.g.
 * "../_services/accounts.service.js") and a map of exported names to
 * implementations. Every fake is a `mock()` so tests can re-implement per
 * case via `fake.mockImplementation(...)`.
 */
export function mockService(
	servicePath: string,
	impl: Record<string, (...args: never[]) => unknown>,
) {
	const fakes = Object.fromEntries(
		Object.entries(impl).map(([name, fn]) => [name, mock(fn as never)]),
	) as Record<string, ReturnType<typeof mock>>;
	mock.module(servicePath, () => fakes);
	return fakes;
}

/** Silence expected console.error noise from error-path tests. */
export function silenceConsoleError() {
	const original = console.error;
	console.error = () => {};
	return () => {
		console.error = original;
	};
}
