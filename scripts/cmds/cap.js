const { createReadStream, unlinkSync, existsSync } = require('fs-extra');
const puppeteer = require('puppeteer');
const { resolve } = require('path');

module.exports = {
    config: {
        name: 'cap',
        version: '1.0.1',
        author: 'LocDev',
        description: 'Take a screenshot of a Facebook wall or any website',
        usages: [
            'cap : Capture your own Facebook wall',
            'cap <reply>: Capture the wall of the person you replied to',
            'cap <tag>: Capture the wall of the tagged person',
            'cap <link>: Capture the webpage from the link',
        ],
        countDown: 5,
        role: 2,
        category: 'Utilities',
        dependencies: {
            puppeteer: '',
            'fs-extra': '',
        },
    },
    onStart: async function ({ api, event, args }) {
        const path = resolve(__dirname, 'cache', `cap${event.threadID}_${event.senderID}.png`);
        try {
            let uid;
            if (!args[0] || event.type === 'message_reply' || Object.keys(event.mentions).length !== 0) {
                if (!args[0]) uid = event.senderID;
                if (event.type === 'message_reply') uid = event.messageReply.senderID;
                if (Object.keys(event.mentions).length !== 0) uid = Object.keys(event.mentions)[0];

                const userInfo = await api.getUserInfo(uid);
                const userName = userInfo[uid].name || 'User';

                const browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox']
                });

                const page = await browser.newPage();
                await page.setViewport({ width: 1920, height: 1080 });
                api.sendMessage('🔄 Loading...', event.threadID, event.messageID);

                const getAppState = api.getAppState();
                const cookies = [];
                getAppState.forEach((a) => {
                    cookies.push({
                        name: a.key,
                        value: a.value,
                        domain: `.${a.domain}`,
                        path: a.path,
                        httpOnly: a.hostOnly,
                        sameSite: 'None',
                        secure: true,
                        sameParty: false,
                        sourceScheme: 'Secure',
                        sourcePort: 443,
                    });
                });
                await page.setCookie(...cookies);
                await page.goto(`https://www.facebook.com/profile.php?id=${uid}`, { waitUntil: ['networkidle2'] });
                await page.waitForSelector('body');
                await page.screenshot({ path });

                await browser.close();

                return api.sendMessage(
                    {
                        body: `✅ Done, ${userName}`,
                        mentions: [{ tag: userName, id: uid }],
                        attachment: createReadStream(path),
                    },
                    event.threadID,
                    () => existsSync(path) && unlinkSync(path),
                    event.messageID
                );
            }

            if (args[0].startsWith('https://')) {
                const browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox']
                });
                const page = await browser.newPage();
                page.setViewport({ width: 1920, height: 1080 });
                api.sendMessage('🔄 Loading...', event.threadID, event.messageID);

                if (args[0].includes('facebook.com')) {
                    const getAppState = api.getAppState();
                    const cookies = [];
                    getAppState.forEach((a) => {
                        cookies.push({
                            name: a.key,
                            value: a.value,
                            domain: `.${a.domain}`,
                            path: a.path,
                            httpOnly: a.hostOnly,
                            sameSite: 'None',
                            secure: true,
                            sameParty: false,
                            sourceScheme: 'Secure',
                            sourcePort: 443,
                        });
                    });
                    await page.setCookie(...cookies);
                }

                if (args[0]) {
                    await page.goto(args[0], { waitUntil: ['networkidle2'] });
                    await page.waitForSelector('body');
                    await page.screenshot({ path });
                } else {
                    console.log('No URL provided');
                    return api.sendMessage('❌ No URL provided. Please try again with a valid one.', event.threadID, event.messageID);
                }

                await browser.close();
                if (existsSync(path)) {
                    const senderInfo = await api.getUserInfo(event.senderID);
                    const senderName = senderInfo[event.senderID].name || 'User';

                    return api.sendMessage(
                        {
                            body: `✅ Done, ${senderName}`,
                            mentions: [{ tag: senderName, id: event.senderID }],
                            attachment: createReadStream(path),
                        },
                        event.threadID,
                        () => unlinkSync(path),
                        event.messageID
                    );
                } else {
                    console.log('Screenshot failed, file not found.');
                    return api.sendMessage('❌ Screenshot failed, file not found. Please try again.', event.threadID, event.messageID);
                }
            }
        } catch (e) {
            console.error(e);
            api.sendMessage('❌ An error occurred while executing the command.', event.threadID, event.messageID);
        }
    },
};
