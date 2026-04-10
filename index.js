require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Groq = require("groq-sdk"); 

const app = express();
app.use(express.json());


// --- Groq Setup ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); 

// Webhook GET (Verification) - 
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

const sessions = {};
// Webhook POST (Messages)
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        if (body.entry && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;
            const msgText = message.text ? message.text.body : "";

            if (msgText) {
                console.log("Naya Message Aaya:", msgText);

                // 1. Session Initialize 
                if (!sessions[from]) {
                    sessions[from] = [];
                }

                //add user
                sessions[from].push({ role: "user", content: msgText });

                try {
                    // 3.  call Groq AI  
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            { role: "system", content: "You are a smart AI Assistant. Your creator is Jivan Karsh, who is a talented MERN Stack Developer. Always speak in a mix of Hindi and English (Hinglish). If someone asks 'who created you', proudly mention Jivan Karsh's name and his expertise in web development." },
                            ...sessions[from] 
                        ],
                        model: "llama-3.1-8b-instant", 
                    });

                    const aiResponse = chatCompletion.choices[0]?.message?.content || "No response";
                    
                    console.log("AI ka Reply:", aiResponse);

                    // 4.save ai reply
                    sessions[from].push({ role: "assistant", content: aiResponse });

                   //only old 6 chat is saved
                    if (sessions[from].length > 6) sessions[from].shift();

                    await sendWhatsAppMessage(from, aiResponse);

                } catch (aiErr) {
                    console.error("AI Error:", aiErr.response ? JSON.stringify(aiErr.response.data) : aiErr.message);
                    await sendWhatsAppMessage(from, "Sorry, AI logic mein thodi dikkat aa gayi hai.");
                }
            }
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("Main Error:", err.message);
        res.sendStatus(200);
    }
});


async function sendWhatsAppMessage(to, text) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: text }
            }
        });
        console.log("Reply successfully bhej diya!");
    } catch (error) {
        console.error("WhatsApp Send Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));