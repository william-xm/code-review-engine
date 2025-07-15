import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// 创建 server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  'hacker-news', // 工具名称
  'get the top stories from hacker news', // 工具描述
  {
    type: z.enum(['topstories', 'newstories', 'beststories']),
    amount: z.number().min(1).max(100).default(10),
  },
  async ({ type, amount }) => {
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/${type}.json`);
    const ids = await response.json() as number[];
    const stories = await Promise.all(ids.slice(0, amount).map(async (id: number) => {
      const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return storyResponse.json();
    }));
    return {
      content: stories.map((story: any) => ({
        type: 'text',
        text: `${story.title} - ${story.url}`,
      })),
    };
  }
)

let transport: SSEServerTransport;

app.get('/sse', (req, res) => {
  transport = new SSEServerTransport('/message', res);
  server.connect(transport);
});

app.get('/message', (req, res) => {
  if (transport) {
    transport.handlePostMessage(req, res);
}});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});




