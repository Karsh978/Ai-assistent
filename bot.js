require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Groq } = require('groq-sdk');

const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sessions = {}; // Chat history maintain rakhne ke liye

const PORT = process.env.PORT || 3000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Delay function human typing effect ke liye
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Webhook Verification (Meta integration ke liye)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('--- Webhook Verified Successfully! ---');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
});

// 2. Incoming Messages Handle Karein
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Meta ko turant response de dete hain

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        // Agar koi text message nahi hai toh ignore karein
        if (!message || message.type !== 'text') return;

        const from = message.from; // Sender ka WhatsApp number
        const msgText = message.text.body; // User ka asli text

        console.log(`\n📩 Received: ${msgText} from ${from}`);

        if (!sessions[from]) sessions[from] = [];
        
        // User ka message memory me push karein
        sessions[from].push({ role: "user", content: msgText });

        // Aapki exact custom system prompt personality
        const systemInstruction = {
            role: "system",
            content: `
            Identity: Tum Jivan ke 'Personal AI Proxy' ho. 
            Personality: Ek dum real insaan ki tarah behave karo jo WhatsApp handle kar raha hai.
            
            Instructions:
            1. Language: Natural Hindi + english (texting style). No robotic words. 
               chatgpt,gemini other ai jaise user se baa krte h smane wale ke reply ka wise tum v kiya kro always help 
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

        // Sirf pichli 12 lines context ke liye slice karein
        const recentHistory = sessions[from].slice(-12);

        // Groq AI Request
        const response = await groq.chat.completions.create({
            messages: [systemInstruction, ...recentHistory],
            model: "llama-3.3-70b-versatile", 
            temperature: 0.8, 
        });
        
        const aiReply = response.choices[0]?.message?.content;

        if (aiReply) {
            // 🔥 Insaani Touch: 3 se 6 second ka random waiting delay
            const randomDelay = Math.floor(Math.random() * 3000) + 3000;
            await delay(randomDelay);

            // WhatsApp Business Cloud API ke through message send karna
            await axios({
                method: 'POST',
                url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    to: from,
                    type: 'text',
                    text: { body: aiReply }
                }
            });

            console.log(`💡 AI Reply sent: ${aiReply}`);
            
            // Assistant ka message memory me push karein
            sessions[from].push({ role: "assistant", content: aiReply });

            // Safe memory clean-up
            if (sessions[from].length > 20) {
                sessions[from].shift();
                sessions[from].shift();
            }
        }

    } catch (error) {
        console.error('❌ Error details:', error.response?.data || error.message);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Jivan's Friendly AI Bot running on port ${PORT}`);
});