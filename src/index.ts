#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpicaClient } from "./client";
import { registerAuthTools } from "./tools/auth";
import { registerDatabaseTools } from "./tools/database";
import { registerDevelopmentTools } from "./tools/development";
import { registerDebugTools } from "./tools/debug";
import { registerAuditingTools } from "./tools/auditing";
import { registerStorageTools } from "./tools/storage";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "./schemas/triggers";

const SPICA_URL = process.env["SPICA_URL"];
const SPICA_APIKEY = process.env["SPICA_APIKEY"];

if (!SPICA_URL || !SPICA_APIKEY) {
  process.stderr.write(
    "Error: SPICA_URL and SPICA_APIKEY environment variables are required.\n",
  );
  process.exit(1);
}

const client = new SpicaClient(SPICA_URL, SPICA_APIKEY);

// Fetch trigger information at startup
const functionInfo = (await client.get(
  "/function/information",
)) as FunctionInformation;
const triggerInfo = buildTriggerSchemas(functionInfo);

const server = new McpServer({
  name: "spica-mcp-server",
  version: "1.0.0",
});

registerAuthTools(server, client);
registerDatabaseTools(server, client);
registerDevelopmentTools(server, client, triggerInfo);
registerDebugTools(server, client);
registerAuditingTools(server, client);
registerStorageTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
