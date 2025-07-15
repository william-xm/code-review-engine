import OpenAI from 'openai';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { REVIEW_SUMMARY_PROMPT } from '../constants/prompt';
import 'dotenv/config';

// 类型定义 (Type definitions)
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  reasoning?: string;
}


// 纯函数：验证工具定义 (Pure function: validate tool definitions)
const validateTools = (tools: Tool[]): boolean => {
  return Array.isArray(tools) && tools.every(tool =>
    tool &&
    typeof tool.name === 'string' &&
    typeof tool.description === 'string'
  );
};


// 纯函数：验证消息格式 (Pure function: validate message format)
const validateMessage = (message: OpenAI.ChatCompletionMessageParam): boolean => {
  return !!(
    message &&
    typeof message.role === 'string' &&
    typeof message.content === 'string' &&
    ['system', 'user', 'assistant', 'tool'].includes(message.role)
  );
};

class ChatOpenAI {
  private readonly llm: OpenAI;
  private readonly model: string;
  private messages: OpenAI.ChatCompletionMessageParam[] = [];
  private readonly tools: Tool[];
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 60000; // 60 seconds

  constructor(
    model: string,
    systemPrompt: string = '',
    tools: Tool[] = [],
    context: string = ''
  ) {
    // 验证环境变量 (Validate environment variables)
    if (!process.env.SILICONFLOW_TOKEN || !process.env.SILICONFLOW_BASE_URL) {
      throw new Error('Missing required environment variables: SILICONFLOW_TOKEN and SILICONFLOW_BASE_URL');
    }

    // 验证输入参数 (Validate input parameters)
    if (!model || typeof model !== 'string') {
      throw new Error('Model name is required and must be a string');
    }

    if (!validateTools(tools)) {
      throw new Error('Invalid tools configuration');
    }

    this.llm = new OpenAI({
      apiKey: process.env.SILICONFLOW_TOKEN,
      baseURL: process.env.SILICONFLOW_BASE_URL,
      timeout: this.timeout,
    });

    this.model = model;
    this.tools = tools;

    // 初始化消息 (Initialize messages)
    this.messages.push({
      role: 'assistant',
      content: REVIEW_SUMMARY_PROMPT
    });

    if (systemPrompt) {
      this.messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    if (context) {
      this.messages.push({
        role: 'user',
        content: context
      });
    }
  }

  // 私有方法：处理流式响应 (Private method: handle streaming response)
  private async processStream(stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>): Promise<ChatResponse> {
    let content = '';
    let toolCalls: ToolCall[] = [];
    let reasoning_content = '';
    let isAnswer = false;

    console.log('\n' + '='.repeat(20) + '思考过程' + '='.repeat(20) + '\n');

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (!delta) continue;

      // 处理思考内容 (Handle reasoning content)
      // @ts-ignore - reasoning_content is a custom property
      if (delta.reasoning_content) {
        if (!isAnswer) {
          // @ts-ignore
          process.stdout.write(delta.reasoning_content);
        }
        // @ts-ignore
        reasoning_content += delta.reasoning_content;
      }

      // 处理主要内容 (Handle main content)
      if (delta.content) {
        if (!isAnswer) {
          console.log('\n' + '='.repeat(20) + '完整回复' + '='.repeat(20) + '\n');
          isAnswer = true;
        }
        content += delta.content;
      }

      // 处理工具调用 (Handle tool calls)
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCalls.length <= toolCall.index) {
            toolCalls.push({
              id: '',
              function: {
                name: '',
                arguments: '',
              },
            });
          }

          const currentToolCall = toolCalls[toolCall.index];
          if (currentToolCall) {
            if (toolCall.id) currentToolCall.id = toolCall.id;
            if (toolCall.function?.name) currentToolCall.function.name += toolCall.function.name;
            if (toolCall.function?.arguments) currentToolCall.function.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    return {
      content,
      toolCalls,
      reasoning: reasoning_content
    };
  }

  // 私有方法：重试机制 (Private method: retry mechanism)
  private async withRetry<T>(operation: () => Promise<T>, retries: number = this.maxRetries): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        // 指数退避 (Exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Max retries exceeded');
  }

  // definition 定义
  private getToolsDefinition() {
    return this.tools.map((tool) => {
      return {
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }
    })
  }

  // 主要的聊天方法 (Main chat method)
  async chat(prompt?: string): Promise<ChatResponse> {
    if (prompt) {
      const message: OpenAI.ChatCompletionMessageParam = { role: 'user', content: prompt };

      if (!validateMessage(message)) {
        throw new Error('Invalid message format');
      }

      this.messages.push(message);
    }

    const chatOperation = async (): Promise<ChatResponse> => {
      const stream = await this.llm.chat.completions.create({
        model: this.model,
        messages: this.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
        tools: this.getToolsDefinition() as OpenAI.Chat.ChatCompletionTool[],
        max_tokens: 4000,
        temperature: 0.7
      });

      return await this.processStream(stream);
    };

    const response = await this.withRetry(chatOperation);

    // 更新消息历史 (Update message history)
    const assistantMessage: OpenAI.ChatCompletionMessageParam = {
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls.map(toolCall => ({
        type: 'function' as const,
        function: toolCall.function,
        id: toolCall.id,
      }))
    };

    this.messages.push(assistantMessage);

    return response;
  }

  // 添加工具结果 (Add tool result)
  public appendToolResult(toolCallId: string, toolOutput: string): void {
    if (!toolCallId || !toolOutput) {
      throw new Error('Tool call ID and output are required');
    }

    const toolMessage: OpenAI.ChatCompletionMessageParam = {
      role: 'tool',
      content: toolOutput,
      tool_call_id: toolCallId,
    };

    if (!validateMessage(toolMessage)) {
      throw new Error('Invalid tool message format');
    }

    this.messages.push(toolMessage);
  }

  // 获取消息历史 (Get message history)
  public getMessageHistory(): OpenAI.ChatCompletionMessageParam[] {
    return [...this.messages]; // 返回副本 (Return copy)
  }

  // 清除消息历史 (Clear message history)
  public clearHistory(): void {
    this.messages = [{
      role: 'assistant',
      content: REVIEW_SUMMARY_PROMPT
    }];
  }

  // 获取统计信息 (Get statistics)
  public getStats(): {
    messageCount: number;
    toolCount: number;
    model: string;
  } {
    return {
      messageCount: this.messages.length,
      toolCount: this.tools.length,
      model: this.model
    };
  }
}

// 导出安全的 ChatOpenAI 类 (Export safe ChatOpenAI class)
export default ChatOpenAI;


