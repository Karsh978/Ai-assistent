require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sessions = {}; 

const client = new Client({
    authStrategy: new LocalAuth(), 
    puppeteer: {
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR Code scan karein:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🚀 AI Bot Active Hai!');
});

client.on('message_create', async (msg) => {
    
  //dont reply agian
    if (msg.fromMe && !msg.body.startsWith('!test')) return;

    console.log(`\n📩 Received: ${msg.body} from ${msg.from}`);

   if (msg.from.includes('@c.us') || msg.from.includes('@lid')){
        const from = msg.from;
        const msgText = msg.body;

        try {
            if (!sessions[from]) sessions[from] = [];
            sessions[from].push({ role: "user", content: msgText });

            console.log("🤖 AI thinking...");

            const response = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are Jivan's Assistant. Reply in Hinglish." },
                    ...sessions[from]
                ],
                model: "llama-3.1-8b-instant",
            });

            const aiReply = response.choices[0]?.message?.content;

            if (aiReply) {
                console.log(`💡 AI Reply: ${aiReply}`);
                
              //send reply
                await client.sendMessage(from, aiReply);
                console.log("✅ Reply Sent!");

                sessions[from].push({ role: "assistant", content: aiReply });
            }
        } catch (err) {
            console.log("❌ Error occurred:", err.message);
           
            await client.sendMessage(from, "Sorry, system thoda busy hai.");
        }
    }
});

client.initialize();