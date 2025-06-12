const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');

module.exports.config = {
    name: "4k",
    version: "1.0.2",
    hasPermssion: 0,
    credits: "Satoru",
    description: "Enhance image using AI",
    category: "ai",
    cooldowns: 5, 
    usePrefix: true
};

module.exports.onStart = async function ({ api, event }) {
    let imgFile;
    if (event.messageReply) {
        imgFile = event.messageReply.attachments.find(attachment => attachment.type == "photo");
    } else {
        imgFile = event.attachments.find(attachment => attachment.type == "photo");
    }

    if (!imgFile)
        return api.sendMessage("Please reply to or send an image to enhance it.", event.threadID, event.messageID);

    const getStream = (await axios.get(imgFile.url, { responseType: 'stream' })).data;

    api.sendMessage("⏳ Enhancing image, please wait...", event.threadID, async (err, info) => {
        try {
            const buffer = await enhanceImage(getStream);

            const pathSaveImg = __dirname + `/cache/enhanced_${event.senderID}_${Date.now()}.png`;
            fs.writeFileSync(pathSaveImg, buffer);

            return api.sendMessage({ 
                body: `✅ Done!\n🖼️ Here is your enhanced image.`,
                attachment: fs.createReadStream(pathSaveImg)
            }, event.threadID, () => {
                fs.unlinkSync(pathSaveImg);
                api.unsendMessage(info.messageID);
            }, event.messageID);
        } catch (error) {
            return api.sendMessage(`An error occurred: ${error.message}`, event.threadID, event.messageID);
        }
    }, event.messageID);
};

async function enhanceImage(fileStream) {
    try {
        const form = new FormData();
        form.append('image', '{}');
        form.append('image', fileStream, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });

        const postUploadResponse = await axios.post('https://api.imggen.ai/guest-upload', form, {
            headers: {
                ...form.getHeaders(),
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://imggen.ai',
                'Referer': 'https://imggen.ai/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            }
        });

        let uploadedImageData = postUploadResponse.data.image;
        uploadedImageData.url = `https://api.imggen.ai${uploadedImageData.url}`;

        const postUpscaleResponse = await axios.post('https://api.imggen.ai/guest-upscale-image', 
            {
                image: uploadedImageData
            },
            {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://imggen.ai',
                    'Referer': 'https://imggen.ai/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
                }
            }
        );

        if (postUpscaleResponse.data.message !== 'Image upscaled successfully') {
            throw new Error('Failed to upscale the image.');
        }

        const upscaledImageUrl = `https://api.imggen.ai${postUpscaleResponse.data.upscaled_image}`;
        const { data: imgBuffer } = await axios.get(upscaledImageUrl, { responseType: 'arraybuffer' });

        return imgBuffer;
    } catch (error) {
        console.error('Error while enhancing image:', error);
        throw new Error('Unable to enhance the image. Please try again later.');
    }
}