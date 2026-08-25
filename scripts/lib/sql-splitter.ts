/**
 * Dollar-quote-aware SQL statement splitter.
 *
 * The Neon HTTP driver executes exactly one statement per request, so
 * migration files must be broken into individual statements before being
 * sent. A naive `.split(/;\s*\n/)` shreds plpgsql function bodies (every
 * `END;` inside a `$$ ... $$` block becomes its own "statement").
 *
 * This scanner tracks lexical state instead:
 *   - `-- line comments`        (semicolons inside are ignored)
 *   - block comments, including Postgres-style nesting
 *   - `'single-quoted strings'` (including '' escaping)
 *   - `"double-quoted identifiers"`
 *   - `$dollar-quoted strings$` (including `$$ ... $$` and `$tag$ ... $tag$`)
 *
 * Comments are preserved (attached to the statement that follows them) so
 * operators see context in failure output, but a segment that contains only
 * comments/whitespace is dropped rather than sent to the server.
 */

/** Returns true if the text contains something executable (not just comments/whitespace). */
export function hasExecutableContent(sql: string): boolean {
	return splitSqlStatements(sql).length > 0;
}

export function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let i = 0;

	type State = "normal" | "line-comment" | "block-comment" | "single-quote" | "double-quote" | "dollar";
	let state: State = "normal";
	let blockDepth = 0;
	// Full opening delimiter of the current dollar-quoted string, e.g. "$$" or "$fn$".
	let dollarTag = "";
	// True once any non-comment code has been appended to `current`.
	let hasCode = false;

	while (i < sql.length) {
		const ch = sql[i];
		const next = i + 1 < sql.length ? sql[i + 1] : "";

		switch (state) {
			case "line-comment": {
				current += ch;
				if (ch === "\n" || ch === "\r") state = "normal";
				i += 1;
				break;
			}

			case "block-comment": {
				if (ch === "*" && next === "/") {
					blockDepth -= 1;
					current += "*/";
					i += 2;
					if (blockDepth === 0) state = "normal";
				} else if (ch === "/" && next === "*") {
					blockDepth += 1;
					current += "/*";
					i += 2;
				} else {
					current += ch;
					i += 1;
				}
				break;
			}

			case "single-quote": {
				if (ch === "'") {
					if (next === "'") {
						current += "''"; // escaped quote inside string literal
						i += 2;
					} else {
						current += "'";
						state = "normal";
						i += 1;
					}
				} else {
					hasCode = true;
					current += ch;
					i += 1;
				}
				break;
			}

			case "double-quote": {
				if (ch === '"') {
					if (next === '"') {
						current += '""';
						i += 2;
					} else {
						current += '"';
						state = "normal";
						i += 1;
					}
				} else {
					hasCode = true;
					current += ch;
					i += 1;
				}
				break;
			}

			case "dollar": {
				if (sql.startsWith(dollarTag, i)) {
					current += dollarTag;
					state = "normal";
					i += dollarTag.length;
				} else {
					current += ch;
					i += 1;
				}
				break;
			}

			case "normal": {
				if (ch === "-" && next === "-") {
					state = "line-comment";
					current += "--";
					i += 2;
					break;
				}
				if (ch === "/" && next === "*") {
					state = "block-comment";
					blockDepth = 1;
					current += "/*";
					i += 2;
					break;
				}
				if (ch === "'") {
					state = "single-quote";
					current += "'";
					i += 1;
					break;
				}
				if (ch === '"') {
					state = "double-quote";
					current += '"';
					i += 1;
					break;
				}
				if (ch === "$") {
					// Postgres dollar-quote openers: $$ or $tag$ where tag matches
					// [A-Za-z_][A-Za-z0-9_]*. Positional params like $1 don't match.
					const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
					if (match) {
						state = "dollar";
						dollarTag = match[0];
						hasCode = true;
						current += dollarTag;
						i += dollarTag.length;
						break;
					}
				}
				if (ch === ";") {
					if (hasCode) {
						current += ";";
						statements.push(current.trim());
					}
					current = "";
					hasCode = false;
					i += 1;
					break;
				}
				if (!/\s/.test(ch)) hasCode = true;
				current += ch;
				i += 1;
			}
		}
	}

	// Trailing segment without a terminating semicolon.
	if (hasCode && current.trim().length > 0) statements.push(current.trim());

	return statements;
}
