require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sessions = {};

// Delay function jo setTimeout se behtar kaam karegi
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        // Yeh line Render ke Linux environment ke liye sahi path set karegi
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome',
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
    // 1. Apne khud ke messages ko ignore karein (except !test)
    if (msg.fromMe && !msg.body.startsWith('!test')) return;

    // 2. Groups ko ignore karein
    if (msg.from.endsWith('@g.us')) return;

    // 3. Sirf personal chats handle karein
    if (msg.from.includes('@c.us') || msg.from.includes('@lid')) {
        const from = msg.from;
        const msgText = msg.body;

        if (!msgText || msgText.length < 1) return;

        console.log(`\n📩 Received: ${msgText} from ${from}`);

        try {
            // Agar pehli baar chat ho rahi hai toh array banao
            if (!sessions[from]) sessions[from] = [];
            
            // User ka message memory mein dalo
            sessions[from].push({ role: "user", content: msgText });

            const chat = await msg.getChat();
            await chat.sendStateTyping();

            // AI Context Builder
            const systemInstruction = {
                role: "system",
                content: `
                Identity: Tum Jivan ke 'Personal AI Proxy' ho. 
                Personality: Ek dum real insaan ki tarah behave karo jo WhatsApp handle kar raha hai.
                
                Instructions:
                1. Language: Natural Hindi + English (texting style). No robotic words like 'Main aapki kya madad kar sakta hu'. Normal dosto jaise baat karo.
                2. Memory: Samne wale ne pehle kya kaha hai, uska dhyan rakh kar reply do. 
                3. Reply Style: Ek dum chhote aur to-the-point replies (Jaise: 'nahi bhai kal off hai', 'haan pta hai', 'puch ke btata hu'). 
                4. Human Touch: Jarurat pede toh 'pata nahi', 'dekhna padega', ya 'shyd' jaise words use karo.
                5. Agar koi school/college ki baat kare jaise "college ja raha hai?", toh aise jawab do jaise tum Jivan ke schedule ko jante ho (e.g., "abhi toh nahi yaar, thoda kaam hai usey").
                6. Samane wala person kya bol rha h usko flow ko smjho ki o kya bol rha h aur unki baat ke according tum usko reply kro.
                7. Gaali nahi dena, ek acche dost ki tarah baat karo aur samne wale ko samjho.
                8. Agr need ho to emoji bhi use kiya kro.
                9. Agr koi ladki baat kr rhi h to unko uske according baat kro, ladki ho to unko 'bhai' mat bolna aur respectful baat krna.
                `
            };

            // Pichle sirf 12 messages hi Groq ko bhejenge (Context maintain rakhne ke liye)
            const recentHistory = sessions[from].slice(-12);

            const response = await groq.chat.completions.create({
                messages: [systemInstruction, ...recentHistory],
                model: "llama-3.3-70b-versatile", 
                temperature: 0.8, 
            });
            
            const aiReply = response.choices[0]?.message?.content;

            if (aiReply) {
                // 🔥 Human-like typing delay (3 se 6 seconds)
                const randomDelay = Math.floor(Math.random() * 3000) + 3000;
                await delay(randomDelay);

                // Message send karein
                await client.sendMessage(from, aiReply);
                console.log(`💡 AI Reply sent: ${aiReply}`);
                
                // Assistant ka reply memory mein dalo
                sessions[from].push({ role: "assistant", content: aiReply });

                // Memory Clean-up Mechanism (Safe Array Maintenance)
                // Agar history 20 elements se badi ho jaye toh purane pair (user + assistant) ko uda do
                if (sessions[from].length > 20) {
                    sessions[from].shift(); // Remove oldest User message
                    sessions[from].shift(); // Remove oldest Assistant message
                }
                
                await chat.clearState();
            }

        } catch (err) {
            console.log("❌ Error:", err.message);
        }
    }
});

client.initialize();