require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sessions = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('QR Code scan karein:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🚀 Jivan AI Bot Active Hai!');
});

client.on('message_create', async (msg) => {
    if (msg.fromMe && !msg.body.startsWith('!test')) return;
    if (msg.from.endsWith('@g.us')) return;

    if (msg.from.includes('@c.us') || msg.from.includes('@lid')) {
        const from = msg.from;
        const msgText = msg.body;

        if (!msgText || msgText.length < 1) return;

        console.log(`\n📩 Received: ${msgText} from ${from}`);

        try {
            if (!sessions[from]) sessions[from] = [];
            sessions[from].push({ role: "user", content: msgText });

            const chat = await msg.getChat();
            await chat.sendStateTyping();

            const systemInstruction = {
                role: "system",
                content: `
                Identity: Tum Jivan ke 'Personal AI Proxy' ho. 
                Personality: Ek dum real insaan ki tarah behave karo jo WhatsApp handle kar raha hai.
                
                Instructions:
                1. Language: Natural Hindi + English (texting style). No robotic words. Normal dosto jaise baat karo.
                2. Memory: Samne wale ne pehle kya kaha hai, uska dhyan rakh kar reply do. 
                3. Reply Style: Ek dum chhote aur to-the-point replies (Jaise: 'nahi bhai kal off hai', 'haan pta hai', 'puch ke btata hu'). 
                4. Human Touch: Jarurat pede toh 'pata nahi', 'dekhna padega', ya 'shyd' jaise words use karo.
                5. Agar koi school ki baat kare jaise "school ja raha hai?", toh aise jawab do jaise tum Jivan ke schedule ko jante ho (e.g., "abhi toh nahi yaar, thoda kaam hai usey").
                6. samane wala person kya bol rha h usko flow ko smjho ki o kya bol rha h and unki baat ke according tum usko reply kro 
                7. gaali ni dena ek acchse people ki trh baat kro samne walo ko smjho wise bat kro
                8. agr need ho to emoji bhi use kiya kro.
                9. agr koi ladki baat kr rhi h to unko unko uske accorrding baat kro ladki baat kr rhi ho to unko bhai bolna mt bolna and usko respectful baat krna .
                `
            };

            const recentHistory = sessions[from].slice(-12);

            const response = await groq.chat.completions.create({
                messages: [systemInstruction, ...recentHistory],
                model: "llama-3.3-70b-versatile", 
                temperature: 0.8, 
            });
            
            const aiReply = response.choices[0]?.message?.content;

            if (aiReply) {
                const randomDelay = Math.floor(Math.random() * 3000) + 3000;
                await delay(randomDelay);

                await client.sendMessage(from, aiReply);
                console.log(`💡 AI Reply sent: ${aiReply}`);
                
                sessions[from].push({ role: "assistant", content: aiReply });

                if (sessions[from].length > 20) {
                    sessions[from].shift();
                    sessions[from].shift();
                }
                
                await chat.clearState();
            }

        } catch (err) {
            console.log("❌ Error:", err.message);
        }
    }
});

client.initialize();