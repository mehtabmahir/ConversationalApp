import {  OpenAI } from "openai";
import * as fs from 'node:fs';
import { response } from "express";

// const DATA_DIRECTORY_PATH = './data/';
const APP_RESOURCES_DIRECTORY_PATH = './app-resources/';
const APP_RESOURCES_WEB_BASE_PATH = '/app-resources/'
export class ConversationalAppEngine {
    userMessages = {};
    openai = null;
    defaultMessages = [];

    constructor(appClass) {
        this.openai = new OpenAI({
            apiKey: "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",
        });
        
        const context = {
            openai: this.openai
        };
        this.app = new appClass(context);
        context.filesDirectoryPath = APP_RESOURCES_DIRECTORY_PATH + this.getFilesDirectoryName() + '/';
        context.webBasePath = APP_RESOURCES_WEB_BASE_PATH + this.getFilesDirectoryName() + '/';


        this.defaultMessages = this.app.getDefaultMessages();

        // if (!fs.existsSync(DATA_DIRECTORY_PATH)) {
        //     fs.mkdirSync(DATA_DIRECTORY_PATH);
        // }

        if (!fs.existsSync(APP_RESOURCES_DIRECTORY_PATH + this.getFilesDirectoryName())) {
            fs.mkdirSync(APP_RESOURCES_DIRECTORY_PATH + this.getFilesDirectoryName());
        }

        this.loadData();
    }

    loadData() {
        const appName = this.app.constructor.name;

        fetch(`http://localhost:3000/api/data/${appName}`)
        .then(response => {
            return response.json();
        })
        .then(data => {
            this.userMessages = data;
            console.log('Loaded data:', this.userMessages);
        })
        .catch(error => {
            console.error('Error:', error);
        });
        
        // fs.readFile(this.getDataFileName(), 'utf8', (error, data) => {
        //     if (error) {
        //         console.log("Error: " + error);
        //     } else {
        //         this.userMessages = JSON.parse(data);
        //     }
        // });
    }

    // getDataFileName() {
    //     return DATA_DIRECTORY_PATH + this.app.constructor.name + '-data.json';
    // }

    getFilesDirectoryName() {
        return this.app.constructor.name;
    }

    storeData() {
        const json = JSON.stringify(this.userMessages, null, 2);
        const appName = this.app.constructor.name

        fetch(`http://localhost:3000/api/data/${appName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: json
        })
            .then(response => {
                return response.json();
            })
            .then(data => {
                console.log('Success:', data);
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    }

        // fs.writeFile(this.getDataFileName(), json, 'utf8', (error) => {
        //     if (error) {
        //         console.log("Error: " + error);
        //     }
        // });
        
    

    getUserChats(userid) {
        const user = this.getUser(userid);
        const chats = [];
        for (const chatid of Object.keys(user)) {
            const chat = user[chatid];
            chats.push({ name: chat.name, id: chatid });
        }
        return chats;
    }

    getUser(userId) {
        return this.userMessages[userId] = this.userMessages[userId] || {};
    }

    getChat(user, chatId) {
        return user[chatId] = user[chatId] || { messages: [...this.defaultMessages], name: "", usage: [], state: {} };
    }

    async getUserChat(userid, chatid) {
        const user = this.getUser(userid);
        const chat = this.getChat(user, chatid);
        const chatMessages = [];

        let i = 0;
        for (const message of chat.messages.slice(this.defaultMessages.length)) {
            if (message.role == 'function' || message.function_call) {
                continue;
            }

            const msg = {
                message: message.role == 'assistant' ? await Promise.resolve(this.app.getTextMessage(message.content)) : message.content,
                appContent: message.role == 'assistant' ? await Promise.resolve(this.app.getAppContent(message.content)) : message.content
            };

            if (message.role == 'assistant') {
                msg.usage = chat.usage[i++];
            }

            chatMessages.push(msg);
        }
        return chatMessages;
    }

    deleteUserChat(userid, chatid) {
        const user = this.getUser(userid);
        delete user[chatid];
        this.storeData();
    }

    postMessage(userid, chatid, message, callback) {
        const user = this.getUser(userid);
        const chat = this.getChat(user, chatid);
        const messages = chat.messages;
        const availableFunctions = this.app.getAvailableFunctions();

        messages.push({ "role": "user", "content": message });

        try {
            this.openai.chat.completions.create({
                model: this.app.model,
                temperature: this.app.temperature,
                messages: messages,
                functions: availableFunctions
            }).then(async (completion) => {//Handle successful response
                console.log("Received from ChatGPT: ");
                console.log(JSON.stringify(completion, null, 2));
                let responseMessageObject = completion.choices[0].message;

                if (responseMessageObject.function_call) {
                    ({ responseMessageObject, completion } = await this.handleFunctionCall(responseMessageObject, availableFunctions, completion, messages));
                }

                //Handle response by app
                const responseMessage = responseMessageObject.content;
                let chatName = await Promise.resolve(this.app.getChatNameFromMessage(responseMessage, message, chat));
                if (chatName) {
                    chat.name = chatName;
                }

                messages.push(responseMessageObject);
                chat.usage.push(completion.usage);
                this.storeData();

                const response = {
                    status: 'success',
                    message: await Promise.resolve(this.app.getTextMessage(responseMessage)),
                    appContent: await Promise.resolve(this.app.getAppContent(responseMessage)),
                    chatName: chat.name,
                    usage: completion.usage
                };

                callback(null, response);
            }).catch(error => {
                messages.pop();
                console.error(error);
                callback({
                    message: error?.message || error
                }, null);
            });
        } catch (error) {
            messages.pop();
            console.error(error);
            callback({
                message: error.message || error
            }, null);
        }
    }

    //handles the invocation of functions if the ChatGPT response includes a function call.
    async handleFunctionCall(responseMessageObject, availableFunctions, completion, messages) {
        while (responseMessageObject.function_call) {
            const functionName = responseMessageObject.function_call.name;
            const hallucinatedFunctionMessages = [];
            //Checking for Available Functions
            if (availableFunctions.find(f => f.name == functionName)) {
                messages.push(responseMessageObject);
                const functionParams = JSON.parse(responseMessageObject.function_call.arguments || '{}');
                const functionResponse = await Promise.resolve(this.app.callFunction(responseMessageObject.function_call.name, functionParams));
                messages.push({
                    "role": "function",
                    "name": functionName,
                    "content": functionResponse || 'none'
                });
            } else {
                hallucinatedFunctionMessages.push(responseMessageObject);
                hallucinatedFunctionMessages.push({
                    "role": "function",
                    "name": functionName,
                    "content": 'none'
                });
            }


            //Sending Updated Messages Back to OpenAI:
            completion = await Promise.resolve(this.openai.chat.completions.create({
                model: this.app.model,
                temperature: this.app.temperature,
                messages: [...messages, ...hallucinatedFunctionMessages],
                functions: availableFunctions
            }));
            console.log("Received from ChatGPT: ");
            console.log(JSON.stringify(completion));
            responseMessageObject = completion.choices[0].message;
        }
        return { responseMessageObject, completion };
    }

    substituteText(text) {
        text = text.replaceAll('{{APP_NAME}}', this.app.appName);
        text = text.replaceAll('{{CHATS_LIST_TITLE}}', this.app.chatListTitle);
        text = text.replaceAll('{{NEW_CHAT}}', this.app.newChatLabel);
        text = text.replaceAll('{{CONTENT_PREVIEW_PLACE_HOLDER}}', this.app.contentPreviewPlaceholder);
        text = text.replaceAll('{{CHAT_START_INSTRUCTIONS}}', this.app.chatStartInstruction);
        text = text.replaceAll('{{NEW_CHAT_NAME}}', this.app.newChatName);
        text = text.replaceAll('{{APP_ICON}}', this.app.appIconName);
        text = text.replaceAll('{{MAX_TOKENS}}', this.app.modelMaxTokens);
        return text;
    }


  
}