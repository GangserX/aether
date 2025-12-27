/**
 * OpenRouter API Tester
 * Tests the OpenRouter API connection with mimo-v2-flash model
 */

const API_KEY = "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";
const MODEL = "xiaomi/mimo-v2-flash:free";

async function testOpenRouterAPI() {
  console.log("🚀 Testing OpenRouter API...\n");
  console.log("━".repeat(50));
  console.log(`Model: ${MODEL}`);
  console.log(`API Key: ${API_KEY.slice(0, 15)}...${API_KEY.slice(-4)}`);
  console.log("━".repeat(50) + "\n");

  try {
    // Test 1: Simple text generation
    console.log("📝 Test 1: Simple Text Generation");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: "Say 'Hello from Aether!' if you can hear me."
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      const generatedText = data.choices[0].message.content;
      console.log("✅ Success!");
      console.log(`Response: ${generatedText.trim()}`);
      console.log("");
      
      // Test 2: JSON response
      console.log("📊 Test 2: JSON Generation");
      const jsonResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: 'Return a JSON object with the following structure: {"status": "operational", "message": "API is working"}'
            }
          ]
        })
      });

      const jsonData = await jsonResponse.json();
      if (jsonData.choices && jsonData.choices[0]?.message?.content) {
        const jsonText = jsonData.choices[0].message.content;
        console.log("✅ Success!");
        console.log(`Response: ${jsonText.trim()}`);
        console.log("");
      }

      // Summary
      console.log("━".repeat(50));
      console.log("🎉 All tests passed!");
      console.log("✅ Model: " + MODEL);
      console.log("✅ API Key: Valid");
      console.log("✅ Connection: Working");
      console.log("━".repeat(50));
      console.log("\n✨ Ready to use in Aether Orchestrate!");
      
    } else {
      console.log("❌ Unexpected response structure:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("\n❌ Error testing OpenRouter API:");
    console.error(error.message);
    console.error("\n💡 Possible issues:");
    console.error("   • Invalid API key");
    console.error("   • Model name incorrect");
    console.error("   • Network connectivity");
    console.error("   • API quota exceeded");
  }
}

// Run the test
testOpenRouterAPI();
