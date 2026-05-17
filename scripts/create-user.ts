#!/usr/bin/env bun
/**
 * Usage: bun run scripts/create-user.ts --email user@example.com --name "Name" --password secret --role admin
 */
import { parseArgs } from "node:util";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		email: { type: "string" },
		name: { type: "string", default: "Admin" },
		password: { type: "string" },
		role: { type: "string", default: "operator" },
	},
	strict: true,
});

if (!values.email || !values.password) {
	console.error("Usage: bun run scripts/create-user.ts --email <email> --password <password> [--name <name>] [--role admin|operator]");
	process.exit(1);
}

if (!["admin", "operator"].includes(values.role!)) {
	console.error("--role must be 'admin' or 'operator'");
	process.exit(1);
}

// Dynamic imports after env is loaded
const { auth } = await import("../src/lib/auth");
const { db } = await import("../src/db/index");
const { userRoles } = await import("../src/db/schema");

console.log(`Creating user: ${values.email} (role: ${values.role})`);

const result = await auth.api.signUpEmail({
	body: {
		email: values.email!,
		password: values.password!,
		name: values.name!,
	},
	headers: new Headers(),
}).catch((err: unknown) => {
	console.error("Failed to create user:", err);
	process.exit(1);
});

if (!result?.user?.id) {
	console.error("Unexpected response from auth.api.signUpEmail");
	process.exit(1);
}

await db
	.insert(userRoles)
	.values({ userId: result.user.id, role: values.role! })
	.onConflictDoUpdate({
		target: userRoles.userId,
		set: { role: values.role! },
	});

console.log(`✓ Created user ${values.email} with id=${result.user.id} role=${values.role}`);
process.exit(0);
