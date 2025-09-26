// Custom Agent Example
// Shows how to create specialized AI agents with custom tools

import {
  createAgent,
  runAgent,
  createCalculatorTool,
  createClaudeLLM,
} from "../ai-server-toolkit/mod.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

if (!CLAUDE_API_KEY) {
  console.error("❌ Please set CLAUDE_API_KEY environment variable");
  Deno.exit(1);
}

// Custom tool: Unit converter
function createUnitConverterTool() {
  return {
    name: "unit_converter",
    description: "Convert between different units of measurement",
    parameters: {
      value: {
        type: "number",
        description: "The value to convert",
      },
      from_unit: {
        type: "string",
        description: "The unit to convert from (e.g., 'meters', 'feet', 'celsius', 'fahrenheit')",
      },
      to_unit: {
        type: "string",
        description: "The unit to convert to",
      },
    },
    handler: async (params: { value: number; from_unit: string; to_unit: string }) => {
      const { value, from_unit, to_unit } = params;

      // Length conversions
      const lengthConversions: Record<string, number> = {
        meters: 1,
        feet: 0.3048,
        inches: 0.0254,
        centimeters: 0.01,
        kilometers: 1000,
        miles: 1609.34,
      };

      // Temperature conversions
      if (from_unit === "celsius" && to_unit === "fahrenheit") {
        return { result: (value * 9/5) + 32, unit: "°F" };
      }
      if (from_unit === "fahrenheit" && to_unit === "celsius") {
        return { result: (value - 32) * 5/9, unit: "°C" };
      }

      // Length conversions
      if (lengthConversions[from_unit] && lengthConversions[to_unit]) {
        const meters = value * lengthConversions[from_unit];
        const result = meters / lengthConversions[to_unit];
        return { result: Math.round(result * 10000) / 10000, unit: to_unit };
      }

      return { error: `Conversion from ${from_unit} to ${to_unit} not supported` };
    },
  };
}

// Custom tool: Random fact generator
function createFactTool() {
  return {
    name: "random_fact",
    description: "Get a random interesting fact",
    parameters: {
      category: {
        type: "string",
        description: "Category of fact (science, history, nature, or random)",
        default: "random",
      },
    },
    handler: async (params: { category?: string }) => {
      const facts = {
        science: [
          "A day on Venus is longer than its year",
          "Bananas are berries, but strawberries aren't",
          "There are more possible chess games than atoms in the observable universe",
        ],
        history: [
          "The Great Wall of China isn't visible from space",
          "Napoleon was actually average height for his time",
          "The first computer bug was an actual bug trapped in a relay",
        ],
        nature: [
          "Octopuses have three hearts and blue blood",
          "A group of flamingos is called a 'flamboyance'",
          "Trees can communicate with each other through underground networks",
        ],
      };

      const allFacts = Object.values(facts).flat();
      const categoryFacts = facts[params.category as keyof typeof facts] || allFacts;

      const randomFact = categoryFacts[Math.floor(Math.random() * categoryFacts.length)];
      return { fact: randomFact, category: params.category || "random" };
    },
  };
}

async function main() {
  console.log("🚀 Creating custom AI agent with specialized tools...");

  try {
    // Create a multi-purpose assistant agent
    const llm = createClaudeLLM({
      provider: 'claude',
      apiKey: CLAUDE_API_KEY,
      model: 'claude-3-sonnet-20240229',
    });

    const agent = createAgent({
      name: "multi-tool-assistant",
      description: "A helpful assistant with calculation, conversion, and fact tools",
      systemPrompt: `You are a helpful assistant with access to useful tools.
You can:
1. Perform mathematical calculations
2. Convert between different units
3. Share interesting facts

Always use the appropriate tools when asked to calculate, convert, or provide facts.
Be friendly and explain your reasoning.`,
      tools: [
        createCalculatorTool(),
        createUnitConverterTool(),
        createFactTool(),
      ],
      llm: {
        provider: 'claude',
        apiKey: CLAUDE_API_KEY,
      },
      memory: true, // Remember conversation context
    });

    console.log("✅ Agent created with 3 custom tools");

    // Test the agent with various requests
    const testRequests = [
      "Calculate the tip for a $87.50 restaurant bill at 18%",
      "Convert 100 meters to feet",
      "Tell me an interesting science fact",
      "What's 25 degrees Celsius in Fahrenheit?",
      "Calculate the area of a circle with radius 5.5",
      "Give me a history fact",
      "Convert 1 mile to kilometers",
    ];

    console.log("\n🤖 Testing agent with various requests...\n");

    for (const request of testRequests) {
      console.log(`\n❓ Request: ${request}`);
      console.log("⏳ Processing...");

      const result = await runAgent(agent, request);

      if (result.success) {
        console.log(`✅ Response: ${result.content}`);

        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log("🔧 Tools used:");
          result.toolCalls.forEach((call, index) => {
            console.log(`   ${index + 1}. ${call.tool}: ${JSON.stringify(call.result)}`);
          });
        }

        if (result.usage) {
          console.log(`📊 Tokens: ${result.usage.totalTokens}`);
        }
      } else {
        console.log(`❌ Error: ${result.error}`);
      }

      console.log("─".repeat(60));

      // Add a small delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test memory by asking a follow-up question
    console.log("\n🧠 Testing memory with follow-up question...");

    await runAgent(agent, "What's the weather like today?");
    const memoryTest = await runAgent(agent, "What was the last calculation I asked you to do?");

    console.log(`Memory test result: ${memoryTest.content}`);

    console.log("\n🎉 Custom agent demo completed successfully!");

  } catch (error) {
    console.error("❌ Error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}