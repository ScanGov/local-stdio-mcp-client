import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "scangovmcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

async function makeScanGovRequest(url) {
  const headers = {
    Accept: "application/json",
    'ScanGov-API-Key': process.env.SCANGOV_API_KEY
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json());
  } catch (error) {
    console.error("Error making ScanGov request:", error);
    return null;
  }
}

// Simple validation function to replace zod
function validateDomain(domain) {
  if (typeof domain !== 'string') {
    throw new Error('Domain must be a string');
  }
  if (!domain || domain.trim().length === 0) {
    throw new Error('Domain cannot be empty');
  }
  return domain.trim();
}

// Register ScanGov tools
server.tool("get_scangov_review", "Get ScanGov analysis for a domain", {
  domain: z.string().describe("Top level domain of the site"),
}, async ({ domain }) => {
  try {
    // Validate input
    const validatedDomain = validateDomain(domain);
    
    let urlStr = validatedDomain;
    if(validatedDomain.indexOf('http') === -1) {
      urlStr = `https://${validatedDomain}`;
    }
    
    let urlInfo = new URL(urlStr);
    const domainVerified = urlInfo.host;
    const endpointForSingleUrl = `https://audits.my.scangov.com/mcp-site?domain=${domainVerified}`;
    const auditInfo = await makeScanGovRequest(endpointForSingleUrl);
    
    let responseTxt;
    if(auditInfo && auditInfo.status === 'error') {
      responseTxt = `Error encountered: ${auditInfo.message}`;
    } else if(auditInfo && auditInfo.data) {
      responseTxt = auditInfo.data;
    } else {
      responseTxt = 'No data received from ScanGov API';
    }

    return {
      content: [
        {
          type: "text",
          text: responseTxt,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ScanGov MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});